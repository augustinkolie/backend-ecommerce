import { createElement } from "react";
import { env } from "@/src/lib/env";
import { sendMail } from "@/src/lib/mail";
import { prisma } from "@/src/lib/prisma";
import { getSettings } from "@/src/lib/settings";
import { AbandonedCart, BackInStock, ReviewRequest } from "@/src/emails/templates";
import { releaseExpiredReservations } from "@/src/modules/orders/service";
import { viewCart } from "@/src/modules/cart/service";

const DAY = 86400_000;

function money(amount: number, currency: string) {
  const digits = currency === "EUR" ? 2 : 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount / 10 ** digits);
}

/** Paniers abandonnés : relance à J+1 (clients connectés, panier non vide, pas de commande depuis). */
export async function abandonedCarts() {
  const settings = await getSettings();
  if (!settings.emails.abandonedCart) return 0;
  const carts = await prisma.cart.findMany({
    where: {
      userId: { not: null },
      reminderSentAt: null,
      updatedAt: { lt: new Date(Date.now() - DAY), gt: new Date(Date.now() - 7 * DAY) },
      items: { some: {} },
    },
    include: { user: true },
    take: 100,
  });
  let sent = 0;
  for (const c of carts) {
    const recentOrder = await prisma.order.findFirst({ where: { userId: c.userId, createdAt: { gt: c.updatedAt } } });
    if (recentOrder || !c.user) continue;
    const full = await prisma.cart.findUniqueOrThrow({
      where: { id: c.id },
      include: {
        coupon: true,
        items: { include: { variant: { include: { attributeValues: { include: { type: true } }, product: { select: { id: true, slug: true, name: true, family: true, categoryId: true, status: true, deletedAt: true, images: { orderBy: { position: "asc" }, include: { colorValue: { select: { value: true } } } } } } } } } },
      },
    });
    const view = await viewCart(full);
    if (view.items.length === 0) continue;
    await sendMail(c.user.email, "Votre panier vous attend", createElement(AbandonedCart, {
      shopName: settings.shopName,
      url: `${env().FRONTEND_URL}/panier`,
      lines: view.items.map((i) => ({ name: i.name, quantity: i.quantity, attributes: i.attributes.map((a) => a.value).join(" · "), total: money(i.lineTotal, view.currency) })),
    }));
    await prisma.cart.update({ where: { id: c.id }, data: { reminderSentAt: new Date() } });
    sent++;
  }
  return sent;
}

/** Demande d'avis à J+7 après livraison. */
export async function reviewRequests() {
  const settings = await getSettings();
  if (!settings.emails.reviewRequest) return 0;
  const orders = await prisma.order.findMany({
    where: { status: "DELIVERED", reviewRequestSentAt: null, shipment: { deliveredAt: { lt: new Date(Date.now() - 7 * DAY) } } },
    include: { items: { include: { variant: { select: { product: { select: { name: true, slug: true } } } } } } },
    take: 100,
  });
  for (const o of orders) {
    const products = new Map<string, { name: string; url: string }>();
    for (const i of o.items) {
      const p = i.variant?.product;
      if (p) products.set(p.slug, { name: p.name, url: `${env().FRONTEND_URL}/p/${p.slug}#avis` });
    }
    await sendMail(o.email, "Votre avis compte", createElement(ReviewRequest, { shopName: settings.shopName, number: o.number, products: [...products.values()] }));
    await prisma.order.update({ where: { id: o.id }, data: { reviewRequestSentAt: new Date() } });
  }
  return orders.length;
}

/** Alertes « retour en stock » pour les variantes réapprovisionnées. */
export async function backInStock() {
  const settings = await getSettings();
  if (!settings.emails.backInStock) return 0;
  const alerts = await prisma.backInStockAlert.findMany({
    where: { notifiedAt: null },
    include: { variant: { include: { product: true, attributeValues: true } } },
    take: 200,
  });
  let sent = 0;
  for (const a of alerts) {
    if (a.variant.stock - a.variant.stockReserved <= 0 || a.variant.deletedAt) continue;
    await sendMail(a.email, `${a.variant.product.name} est de retour`, createElement(BackInStock, {
      shopName: settings.shopName,
      name: a.variant.product.name,
      variant: a.variant.attributeValues.map((v) => v.value).join(" · "),
      url: `${env().FRONTEND_URL}/p/${a.variant.product.slug}`,
    }));
    await prisma.backInStockAlert.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
    sent++;
  }
  return sent;
}

/** Paniers invités expirés (30 jours). */
export async function purgeGuestCarts() {
  const res = await prisma.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(Date.now() - 30 * DAY) } } });
  return res.count;
}

export const JOBS = {
  "release-reservations": releaseExpiredReservations,
  "abandoned-carts": abandonedCarts,
  "review-requests": reviewRequests,
  "back-in-stock": backInStock,
  "purge-guest-carts": purgeGuestCarts,
} as const;

export type JobName = keyof typeof JOBS;

export async function runAll() {
  const results: Record<string, number | string> = {};
  for (const [name, fn] of Object.entries(JOBS)) {
    try {
      results[name] = await fn();
    } catch (err) {
      results[name] = `erreur : ${(err as Error).message}`;
    }
  }
  return results;
}
