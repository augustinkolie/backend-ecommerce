import { createElement } from "react";
import type { Order, OrderStatus, Prisma } from "@/src/generated/prisma/client";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { AppError } from "@/src/lib/errors";
import { sendMail } from "@/src/lib/mail";
import { prisma } from "@/src/lib/prisma";
import { can, SUPPORT_REFUND_LIMIT } from "@/src/lib/rbac";
import { getSettings } from "@/src/lib/settings";
import { OrderConfirmation, OrderDelivered, OrderShipped } from "@/src/emails/templates";
import { clearCart, resolveCart, viewCart } from "../cart/service";
import { listZones } from "../shipping/service";
import { provider, type WebhookEvent } from "../payments/providers";
import type { CheckoutInput } from "./schema";

export const RESERVATION_MINUTES = 15;

type Tx = Prisma.TransactionClient;

function formatMoney(amount: number, currency: string) {
  const digits = currency === "EUR" ? 2 : 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    amount / 10 ** digits,
  );
}

async function event(tx: Tx, orderId: string, type: string, message: string, authorId?: string | null, internal = true) {
  await tx.orderEvent.create({ data: { orderId, type, message, authorId: authorId ?? undefined, internal } });
}

/** Réserve atomiquement : échoue si stock - réservé < quantité. */
async function reserve(tx: Tx, variantId: string, quantity: number) {
  const n = await tx.$executeRaw`
    UPDATE "ProductVariant" SET "stockReserved" = "stockReserved" + ${quantity}
    WHERE id = ${variantId} AND "deletedAt" IS NULL AND "stock" - "stockReserved" >= ${quantity}`;
  return n === 1;
}

async function releaseReservation(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } } });
  for (const i of items) {
    await tx.$executeRaw`
      UPDATE "ProductVariant" SET "stockReserved" = GREATEST(0, "stockReserved" - ${i.quantity}) WHERE id = ${i.variantId}`;
  }
}

/** Réservation → vente : stock et réservé décrémentés, mouvement SALE tracé. */
async function commitStock(tx: Tx, orderId: string, number: number) {
  const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } } });
  for (const i of items) {
    await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stock" = "stock" - ${i.quantity}, "stockReserved" = GREATEST(0, "stockReserved" - ${i.quantity})
      WHERE id = ${i.variantId}`;
    await tx.stockMovement.create({
      data: { variantId: i.variantId!, type: "SALE", quantity: -i.quantity, reason: `Commande n° ${number}` },
    });
  }
}

// ---------------------------------------------------------------- Checkout

export async function checkout(req: Request, input: CheckoutInput, idempotencyKey: string, user: AuthUser | null) {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (existing) return { order: existing, redirectUrl: null, replay: true };

  const settings = await getSettings();
  const method = settings.paymentMethods.find((m) => m.code === input.paymentMethod && m.enabled);
  if (!method) throw AppError.badRequest("Moyen de paiement indisponible", { paymentMethod: ["Moyen de paiement indisponible"] });
  const pay = provider(input.paymentMethod);

  const zones = await listZones();
  const zone = zones.find((z) => z.id === input.shippingZoneId);
  if (!zone) throw AppError.badRequest("Mode de livraison invalide", { shippingZoneId: ["Mode de livraison invalide"] });
  if (!zone.isPickup && (!input.address.line1 || !input.address.city)) {
    throw AppError.badRequest("Adresse incomplète", {
      ...(input.address.line1 ? {} : { "address.line1": ["Adresse requise"] }),
      ...(input.address.city ? {} : { "address.city": ["Ville requise"] }),
    });
  }

  const { cart } = await resolveCart(req, false);
  if (!cart || cart.items.length === 0) throw AppError.badRequest("Votre panier est vide.");

  // Prix TOUJOURS recalculés côté serveur.
  const view = await viewCart(cart, input.address.city);
  const shipping = zone.isPickup
    ? 0
    : view.coupon?.type === "FREE_SHIPPING" || (zone.freeAbove ?? settings.freeShippingThreshold ?? Infinity) <= view.subtotal - view.discount
      ? 0
      : zone.price;
  const total = Math.max(0, view.subtotal - view.discount + shipping);

  const order = await prisma.$transaction(async (tx) => {
    for (const item of view.items) {
      if (!(await reserve(tx, item.variantId, item.quantity))) {
        throw AppError.conflict(`Stock insuffisant pour ${item.name} (${item.attributes.map((a) => a.value).join(", ")}).`);
      }
    }
    const created = await tx.order.create({
      data: {
        userId: user?.id,
        email: input.email,
        status: "PENDING_PAYMENT",
        subtotal: view.subtotal,
        shippingTotal: shipping,
        discountTotal: view.discount,
        total,
        currency: settings.currency,
        shippingAddress: input.address,
        shippingMethod: zone.name,
        shippingZoneId: zone.id,
        paymentMethod: input.paymentMethod,
        couponId: cart.couponId,
        idempotencyKey,
        reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60_000),
        internalNotes: input.note,
        items: {
          create: view.items.map((i) => ({
            variantId: i.variantId,
            name: i.name,
            sku: i.sku,
            attributes: i.attributes,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
          })),
        },
      },
    });
    if (cart.couponId) await tx.coupon.update({ where: { id: cart.couponId }, data: { usedCount: { increment: 1 } } });
    await event(tx, created.id, "status", "Commande créée, stock réservé 15 min", null, false);
    if (user && input.saveAddress && !zone.isPickup) {
      const count = await tx.address.count({ where: { userId: user.id } });
      await tx.address.create({
        data: { userId: user.id, name: input.address.name, line1: input.address.line1, line2: input.address.line2, city: input.address.city, country: input.address.country, phone: input.address.phone, isDefault: count === 0 },
      });
    }
    return created;
  });

  await clearCart(cart.id);

  if (pay.immediate) {
    await confirmCashOnDelivery(order.id);
    return { order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }), redirectUrl: null, replay: false };
  }

  try {
    const { redirectUrl, externalRef } = await pay.initiate(order);
    await prisma.payment.create({
      data: { orderId: order.id, provider: pay.code, externalRef, amount: order.total, idempotencyKey: `${idempotencyKey}:pay` },
    });
    return { order, redirectUrl, replay: false };
  } catch (err) {
    await cancelOrder(order.id, "Échec de l'initialisation du paiement", null);
    throw err;
  }
}

/** Paiement à la livraison : la vente est confirmée tout de suite, le paiement reste « à payer ». */
async function confirmCashOnDelivery(orderId: string) {
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    await commitStock(tx, o.id, o.number);
    await tx.payment.create({ data: { orderId: o.id, provider: "cash_on_delivery", amount: o.total, status: "PENDING" } });
    await event(tx, o.id, "payment", "Paiement à la livraison : stock confirmé", null, false);
    return tx.order.update({ where: { id: o.id }, data: { reservedUntil: null } });
  });
  await sendConfirmation(order);
}

// ---------------------------------------------------------------- Paiement (webhook)

export async function handlePaymentEvent(providerCode: string, evt: WebhookEvent) {
  const order = await prisma.order.findUnique({ where: { id: evt.orderId } });
  if (!order) throw AppError.notFound("Commande introuvable");

  // Idempotence : un même événement opérateur n'est traité qu'une fois.
  const already = await prisma.payment.findFirst({
    where: { provider: providerCode, externalRef: evt.externalRef, status: { in: ["SUCCEEDED", "FAILED"] } },
  });
  if (already) return { orderId: order.id, status: order.status, duplicate: true };

  if (evt.status === "failed") {
    await prisma.$transaction(async (tx) => {
      await upsertPayment(tx, order, providerCode, evt, "FAILED");
      await event(tx, order.id, "payment", "Paiement refusé", null, false);
    });
    return { orderId: order.id, status: order.status, duplicate: false };
  }

  if (evt.amount !== order.total) throw AppError.badRequest("Montant du paiement incohérent");

  const updated = await prisma.$transaction(async (tx) => {
    await upsertPayment(tx, order, providerCode, evt, "SUCCEEDED");
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    if (fresh.status === "PENDING_PAYMENT") {
      await commitStock(tx, fresh.id, fresh.number);
    } else if (fresh.status === "CANCELLED") {
      // Réservation expirée avant le paiement : on tente de reprendre le stock.
      const items = await tx.orderItem.findMany({ where: { orderId: fresh.id } });
      for (const i of items) {
        if (!i.variantId || !(await reserve(tx, i.variantId, i.quantity))) {
          await event(tx, fresh.id, "payment", "Paiement reçu après expiration, stock insuffisant : remboursement requis");
          return fresh;
        }
      }
      await commitStock(tx, fresh.id, fresh.number);
    } else {
      return fresh;
    }
    await event(tx, fresh.id, "payment", `Paiement confirmé (${providerCode})`, null, false);
    return tx.order.update({ where: { id: fresh.id }, data: { status: "PAID", reservedUntil: null } });
  });

  if (updated.status === "PAID") await sendConfirmation(updated);
  return { orderId: updated.id, status: updated.status, duplicate: false };
}

async function upsertPayment(tx: Tx, order: Order, providerCode: string, evt: WebhookEvent, status: "SUCCEEDED" | "FAILED") {
  const pending = await tx.payment.findFirst({ where: { orderId: order.id, provider: providerCode, status: "PENDING" } });
  if (pending) {
    await tx.payment.update({ where: { id: pending.id }, data: { status, externalRef: evt.externalRef, amount: evt.amount } });
  } else {
    await tx.payment.create({ data: { orderId: order.id, provider: providerCode, externalRef: evt.externalRef, amount: evt.amount, status } });
  }
}

async function sendConfirmation(order: Order) {
  const settings = await getSettings();
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  const label = settings.paymentMethods.find((m) => m.code === order.paymentMethod)?.label ?? order.paymentMethod;
  await sendMail(
    order.email,
    `Commande n° ${order.number} confirmée — ${settings.shopName}`,
    createElement(OrderConfirmation, {
      shopName: settings.shopName,
      number: order.number,
      paymentLabel: label,
      total: formatMoney(order.total, order.currency),
      url: `${env().FRONTEND_URL}/compte/commandes/${order.number}`,
      lines: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        attributes: (i.attributes as { value: string }[]).map((a) => a.value).join(" · "),
        total: formatMoney(i.unitPrice * i.quantity, order.currency),
      })),
    }),
  );
}

// ---------------------------------------------------------------- Annulation / expiration

export async function cancelOrder(orderId: string, reason: string, author: AuthUser | null) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (o.status === "CANCELLED" || o.status === "REFUNDED") return o;
    if (o.reservedUntil) {
      await releaseReservation(tx, o.id);
    } else if (["PENDING_PAYMENT", "PAID", "PREPARING"].includes(o.status)) {
      // Stock déjà décrémenté : on le remet.
      await restock(tx, o.id, `Annulation commande n° ${o.number}`, author);
    }
    if (o.couponId) await tx.coupon.update({ where: { id: o.couponId }, data: { usedCount: { decrement: 1 } } });
    await event(tx, o.id, "status", `Commande annulée : ${reason}`, author?.id, false);
    return tx.order.update({ where: { id: o.id }, data: { status: "CANCELLED", reservedUntil: null } });
  });
}

async function restock(tx: Tx, orderId: string, reason: string, author: AuthUser | null) {
  const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } } });
  for (const i of items) {
    await tx.productVariant.update({ where: { id: i.variantId! }, data: { stock: { increment: i.quantity } } });
    await tx.stockMovement.create({ data: { variantId: i.variantId!, type: "RETURN", quantity: i.quantity, reason, authorId: author?.id } });
  }
}

/** Job : libère les réservations expirées (commandes non payées après 15 min). */
export async function releaseExpiredReservations() {
  const expired = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", reservedUntil: { lt: new Date() } },
    select: { id: true },
  });
  for (const o of expired) await cancelOrder(o.id, "paiement non reçu dans les 15 minutes", null);
  return expired.length;
}

// ---------------------------------------------------------------- Admin : statut, remboursement, notes

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "PREPARING", "CANCELLED"],
  PAID: ["PREPARING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PREPARING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export async function changeStatus(
  orderId: string,
  input: { status: OrderStatus; carrier?: string; trackingNumber?: string; notify: boolean },
  author: AuthUser,
) {
  const before = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!before) throw AppError.notFound("Commande introuvable");
  if (before.status === input.status) return before;
  if (!TRANSITIONS[before.status].includes(input.status)) {
    throw AppError.badRequest(`Passage de « ${before.status} » à « ${input.status} » impossible.`);
  }
  if (author.role === "STOCK" && !["PREPARING", "SHIPPED"].includes(input.status)) throw AppError.forbidden();
  if (input.status === "CANCELLED") {
    const o = await cancelOrder(orderId, "annulée par l'équipe", author);
    await audit(author, "order.cancel", "Order", orderId, { status: before.status }, { status: o.status });
    return o;
  }
  if (input.status === "REFUNDED") throw AppError.badRequest("Utilisez l'action Rembourser.");

  const updated = await prisma.$transaction(async (tx) => {
    if (input.status === "SHIPPED") {
      await tx.shipment.upsert({
        where: { orderId },
        create: { orderId, carrier: input.carrier || "Livreur boutique", trackingNumber: input.trackingNumber, shippedAt: new Date() },
        update: { carrier: input.carrier || undefined, trackingNumber: input.trackingNumber, shippedAt: new Date() },
      });
    }
    if (input.status === "DELIVERED") {
      await tx.shipment.upsert({
        where: { orderId },
        create: { orderId, carrier: "Livreur boutique", deliveredAt: new Date() },
        update: { deliveredAt: new Date() },
      });
      // Paiement à la livraison encaissé.
      await tx.payment.updateMany({ where: { orderId, provider: "cash_on_delivery", status: "PENDING" }, data: { status: "SUCCEEDED" } });
    }
    if (input.status === "PAID" && before.reservedUntil) {
      await commitStock(tx, orderId, before.number);
    }
    await event(tx, orderId, "status", `Statut : ${input.status}`, author.id, false);
    const o = await tx.order.update({ where: { id: orderId }, data: { status: input.status, reservedUntil: null }, include: { shipment: true } });
    await audit(author, "order.status", "Order", orderId, { status: before.status }, { status: o.status }, tx);
    return o;
  });

  if (input.notify) {
    const settings = await getSettings();
    const url = `${env().FRONTEND_URL}/compte/commandes/${updated.number}`;
    if (input.status === "SHIPPED") {
      await sendMail(updated.email, `Commande n° ${updated.number} expédiée`, createElement(OrderShipped, {
        shopName: settings.shopName, number: updated.number, carrier: updated.shipment?.carrier ?? "notre livreur", tracking: updated.shipment?.trackingNumber, url,
      }));
    }
    if (input.status === "DELIVERED") {
      await sendMail(updated.email, `Commande n° ${updated.number} livrée`, createElement(OrderDelivered, { shopName: settings.shopName, number: updated.number, url }));
    }
  }
  return updated;
}

export async function refundOrder(orderId: string, input: { amount: number; reason: string; restock: boolean }, author: AuthUser) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) throw AppError.notFound("Commande introuvable");
  if (!can(author.role, "orders.refund.unlimited") && input.amount > SUPPORT_REFUND_LIMIT) {
    throw AppError.forbidden("Montant au-delà du seuil autorisé pour votre rôle.");
  }
  const paid = order.payments.filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED");
  const refundable = paid.reduce((n, p) => n + p.amount - p.refundedAmount, 0);
  if (input.amount > refundable) throw AppError.badRequest(`Montant remboursable maximum : ${refundable}`);

  return prisma.$transaction(async (tx) => {
    let remaining = input.amount;
    for (const p of paid) {
      if (remaining <= 0) break;
      const part = Math.min(remaining, p.amount - p.refundedAmount);
      const refunded = p.refundedAmount + part;
      await tx.payment.update({
        where: { id: p.id },
        data: { refundedAmount: refunded, status: refunded >= p.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
      remaining -= part;
    }
    const full = input.amount === refundable;
    if (full && input.restock) await restock(tx, order.id, `Remboursement commande n° ${order.number}`, author);
    await event(tx, order.id, "refund", `Remboursement ${full ? "total" : "partiel"} : ${input.amount}${input.reason ? ` — ${input.reason}` : ""}`, author.id);
    const o = await tx.order.update({ where: { id: order.id }, data: full ? { status: "REFUNDED" } : {} });
    await audit(author, "order.refund", "Order", order.id, { status: order.status }, { status: o.status, amount: input.amount }, tx);
    return o;
  });
}

export async function addNote(orderId: string, message: string, author: AuthUser) {
  await prisma.orderEvent.create({ data: { orderId, type: "note", message, authorId: author.id, internal: true } });
}

// ---------------------------------------------------------------- Lecture

export const orderDetailInclude = {
  items: true,
  payments: { orderBy: { createdAt: "asc" } },
  shipment: true,
  events: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true, email: true } } } },
  user: { select: { id: true, name: true, email: true, phone: true } },
  coupon: { select: { code: true } },
} satisfies Prisma.OrderInclude;

export async function customerOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true, shipment: true },
  });
}

export async function customerOrder(userId: string, number: number) {
  const order = await prisma.order.findFirst({
    where: { userId, number },
    include: { items: { include: { variant: { select: { product: { select: { slug: true, images: { take: 1, orderBy: { position: "asc" } } } } } } } }, shipment: true, events: { where: { internal: false }, orderBy: { createdAt: "asc" } }, returns: true },
  });
  if (!order) throw AppError.notFound("Commande introuvable");
  return order;
}

/** Suivi public après paiement (page de confirmation, commande invité). */
export async function publicOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, status: true, total: true, currency: true, email: true, paymentMethod: true, shippingMethod: true, createdAt: true, items: { select: { name: true, quantity: true, unitPrice: true, attributes: true } } },
  });
  if (!order) throw AppError.notFound("Commande introuvable");
  return { ...order, email: order.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2") };
}
