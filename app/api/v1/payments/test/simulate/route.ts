import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/src/lib/errors";
import { handle, ok, parseBody } from "@/src/lib/http";
import { prisma } from "@/src/lib/prisma";
import { getSettings } from "@/src/lib/settings";
import { handlePaymentEvent } from "@/src/modules/orders/service";

const body = z.object({ orderId: z.string().min(1), outcome: z.enum(["succeeded", "failed"]) });

/** Page de paiement factice (carte test) : simule la réponse de l'opérateur. */
export const POST = handle(async (req) => {
  const settings = await getSettings();
  if (!settings.paymentMethods.some((m) => m.code === "test_card" && m.enabled)) throw AppError.forbidden("Carte test désactivée");
  const { orderId, outcome } = await parseBody(req, body);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentMethod !== "test_card") throw AppError.notFound("Commande introuvable");
  return ok(await handlePaymentEvent("test_card", { orderId, externalRef: `test_${randomUUID()}`, amount: order.total, status: outcome }));
});
