import { createHmac, timingSafeEqual } from "node:crypto";
import type { Order } from "@/src/generated/prisma/client";
import { env } from "@/src/lib/env";
import { AppError } from "@/src/lib/errors";

export type WebhookEvent = {
  orderId: string;
  externalRef: string;
  amount: number;
  status: "succeeded" | "failed";
};

export type PaymentProvider = {
  code: string;
  /** Paiement confirmé immédiatement (paiement à la livraison). */
  immediate?: boolean;
  initiate(order: Order): Promise<{ redirectUrl: string | null; externalRef: string | null }>;
  verifyWebhook(req: Request, rawBody: string): Promise<WebhookEvent>;
};

export function sign(rawBody: string, secret = env().PAYMENT_WEBHOOK_SECRET) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Vérifie la signature HMAC-SHA256 (en-tête x-signature) en temps constant. */
export function verifySignature(rawBody: string, signature: string | null, secret = env().PAYMENT_WEBHOOK_SECRET) {
  if (!signature) return false;
  const expected = Buffer.from(sign(rawBody, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function parseSignedEvent(req: Request, rawBody: string, secret?: string): WebhookEvent {
  if (!verifySignature(rawBody, req.headers.get("x-signature"), secret)) {
    throw new AppError(401, "INVALID_SIGNATURE", "Signature de webhook invalide");
  }
  const data = JSON.parse(rawBody) as Partial<WebhookEvent>;
  if (!data.orderId || !data.externalRef || typeof data.amount !== "number" || !data.status) {
    throw AppError.badRequest("Webhook incomplet");
  }
  return data as WebhookEvent;
}

const cashOnDelivery: PaymentProvider = {
  code: "cash_on_delivery",
  immediate: true,
  async initiate() {
    return { redirectUrl: null, externalRef: null };
  },
  async verifyWebhook() {
    throw AppError.badRequest("Pas de webhook pour le paiement à la livraison");
  },
};

/** Carte simulée : redirige vers une page de paiement factice du frontend (dev/recette). */
const testCard: PaymentProvider = {
  code: "test_card",
  async initiate(order) {
    return { redirectUrl: `${env().FRONTEND_URL}/commande/paiement-test?order=${order.id}`, externalRef: null };
  },
  async verifyWebhook(req, rawBody) {
    return parseSignedEvent(req, rawBody);
  },
};

/**
 * Orange Money / MTN MoMo : l'initiation appelle l'API de l'opérateur
 * (à brancher avec les identifiants marchands), le webhook est vérifié par signature.
 */
function mobileMoney(code: "orange_money" | "mtn_momo"): PaymentProvider {
  return {
    code,
    async initiate() {
      const configured = code === "orange_money" ? env().ORANGE_MONEY_CLIENT_ID : env().MTN_MOMO_SUBSCRIPTION_KEY;
      if (!configured) {
        throw new AppError(503, "PAYMENT_UNAVAILABLE", "Ce moyen de paiement n'est pas encore configuré.");
      }
      // Intégration opérateur : créer la transaction et renvoyer l'URL / l'invite USSD.
      throw new AppError(501, "NOT_IMPLEMENTED", "Intégration opérateur à finaliser avec les identifiants marchands.");
    },
    async verifyWebhook(req, rawBody) {
      return parseSignedEvent(req, rawBody);
    },
  };
}

const providers: Record<string, PaymentProvider> = {
  cash_on_delivery: cashOnDelivery,
  test_card: testCard,
  orange_money: mobileMoney("orange_money"),
  mtn_momo: mobileMoney("mtn_momo"),
};

export function provider(code: string) {
  const p = providers[code];
  if (!p) throw AppError.badRequest("Moyen de paiement inconnu", { paymentMethod: ["Moyen de paiement inconnu"] });
  return p;
}
