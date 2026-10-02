/**
 * Tests d'intégration API (base PostgreSQL réelle, DATABASE_URL) :
 * réservation de stock, idempotence, webhook signé, expiration, droits par rôle.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as checkoutRoute } from "@/app/api/v1/checkout/route";
import { POST as webhookRoute } from "@/app/api/v1/webhooks/payments/[provider]/route";
import { GET as statsRoute } from "@/app/api/v1/admin/stats/route";
import { signAccessToken } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { sign } from "@/src/modules/payments/providers";
import { releaseExpiredReservations } from "./service";

const RUN = randomUUID().slice(0, 8);
const ids: { categoryId?: string; productId?: string; variantId?: string; zoneId?: string; carts: string[]; orders: string[] } = { carts: [], orders: [] };

async function newCart(quantity: number) {
  const sessionId = `test-${RUN}-${randomUUID()}`;
  const cart = await prisma.cart.create({ data: { sessionId, items: { create: { variantId: ids.variantId!, quantity } } } });
  ids.carts.push(cart.id);
  return sessionId;
}

function checkoutRequest(sessionId: string, key: string, paymentMethod = "test_card") {
  return new Request("http://test/api/v1/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `cid=${sessionId}`, "idempotency-key": key, "x-forwarded-for": `10.0.${Math.floor(Math.random() * 250)}.1` },
    body: JSON.stringify({
      email: `client-${RUN}@exemple.gn`,
      address: { name: "Client Test", phone: "620000000", line1: "Rue 1", city: "Conakry" },
      shippingZoneId: ids.zoneId,
      paymentMethod,
    }),
  });
}

const variant = () => prisma.productVariant.findUniqueOrThrow({ where: { id: ids.variantId! } });
const noCtx = { params: Promise.resolve({}) } as never;

beforeAll(async () => {
  const cat = await prisma.category.create({ data: { name: `Test ${RUN}`, slug: `test-${RUN}` } });
  const product = await prisma.product.create({
    data: { name: `Produit test ${RUN}`, slug: `produit-test-${RUN}`, description: "Test", family: "TSHIRT", status: "PUBLISHED", publishedAt: new Date(), categoryId: cat.id },
  });
  const v = await prisma.productVariant.create({ data: { productId: product.id, sku: `TEST-${RUN}`, price: 100_000, stock: 5 } });
  const zone = await prisma.shippingZone.create({ data: { name: `Zone test ${RUN}`, cities: ["Conakry"], price: 30_000, position: 999 } });
  Object.assign(ids, { categoryId: cat.id, productId: product.id, variantId: v.id, zoneId: zone.id });
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { email: `client-${RUN}@exemple.gn` }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  await prisma.$transaction([
    prisma.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.cart.deleteMany({ where: { id: { in: ids.carts } } }),
    prisma.stockMovement.deleteMany({ where: { variantId: ids.variantId } }),
    prisma.productVariant.deleteMany({ where: { id: ids.variantId } }),
    prisma.product.deleteMany({ where: { id: ids.productId } }),
    prisma.category.deleteMany({ where: { id: ids.categoryId } }),
    prisma.shippingZone.deleteMany({ where: { id: ids.zoneId } }),
  ]);
  await prisma.$disconnect();
});

describe("checkout + paiement", () => {
  it("réserve le stock, rejoue la même commande avec la même clé, puis confirme la vente au webhook", async () => {
    const session = await newCart(2);
    const key = `key-${RUN}-1`;

    const res = await checkoutRoute(checkoutRequest(session, key), noCtx);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.status).toBe("PENDING_PAYMENT");
    // Prix recalculés côté serveur : 2 × 100 000 + 30 000 de livraison.
    expect(data.total).toBe(230_000);

    let v = await variant();
    expect(v.stock).toBe(5);
    expect(v.stockReserved).toBe(2);

    // Idempotence : même clé → même commande, aucune nouvelle réservation.
    const replay = await checkoutRoute(checkoutRequest(session, key), noCtx);
    expect(replay.status).toBe(200);
    expect((await replay.json()).data.orderId).toBe(data.orderId);
    expect((await variant()).stockReserved).toBe(2);

    // Webhook à signature invalide : refusé.
    const payload = JSON.stringify({ orderId: data.orderId, externalRef: `ext-${RUN}`, amount: data.total, status: "succeeded" });
    const bad = await webhookRoute(new Request("http://test", { method: "POST", headers: { "x-signature": "bad" }, body: payload }), { params: Promise.resolve({ provider: "test_card" }) });
    expect(bad.status).toBe(401);

    // Webhook signé : vente confirmée, stock décrémenté en transaction.
    const ok = await webhookRoute(new Request("http://test", { method: "POST", headers: { "x-signature": sign(payload) }, body: payload }), { params: Promise.resolve({ provider: "test_card" }) });
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.status).toBe("PAID");
    v = await variant();
    expect(v.stock).toBe(3);
    expect(v.stockReserved).toBe(0);

    // Webhook rejoué : ignoré (pas de double décrément).
    const dup = await webhookRoute(new Request("http://test", { method: "POST", headers: { "x-signature": sign(payload) }, body: payload }), { params: Promise.resolve({ provider: "test_card" }) });
    expect((await dup.json()).data.duplicate).toBe(true);
    expect((await variant()).stock).toBe(3);
  });

  it("libère la réservation d'une commande non payée après expiration", async () => {
    const session = await newCart(1);
    const res = await checkoutRoute(checkoutRequest(session, `key-${RUN}-2`), noCtx);
    const { data } = await res.json();
    expect((await variant()).stockReserved).toBe(1);

    await prisma.order.update({ where: { id: data.orderId }, data: { reservedUntil: new Date(Date.now() - 1000) } });
    await releaseExpiredReservations();

    expect((await variant()).stockReserved).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: data.orderId } })).status).toBe("CANCELLED");
  });

  it("refuse la commande si le stock disponible est insuffisant (zéro survente)", async () => {
    const session = await newCart(50);
    const res = await checkoutRoute(checkoutRequest(session, `key-${RUN}-3`), noCtx);
    expect(res.status).toBe(409);
    expect((await variant()).stockReserved).toBe(0);
  });

  it("le paiement à la livraison confirme immédiatement la sortie de stock", async () => {
    const before = (await variant()).stock;
    const session = await newCart(1);
    const res = await checkoutRoute(checkoutRequest(session, `key-${RUN}-4`, "cash_on_delivery"), noCtx);
    expect(res.status).toBe(201);
    const v = await variant();
    expect(v.stock).toBe(before - 1);
    expect(v.stockReserved).toBe(0);
  });
});

describe("droits par rôle", () => {
  it("le magasinier n'accède pas au tableau de bord, le propriétaire si", async () => {
    const asRole = async (role: "STOCK" | "OWNER") => {
      const token = await signAccessToken({ id: `test-${role}`, role, email: `${role}@test` });
      return statsRoute(new Request("http://test/api/v1/admin/stats", { headers: { authorization: `Bearer ${token}` } }), noCtx);
    };
    expect((await asRole("STOCK")).status).toBe(403);
    expect((await asRole("OWNER")).status).toBe(200);
  });

  it("sans authentification : 401", async () => {
    const res = await statsRoute(new Request("http://test/api/v1/admin/stats"), noCtx);
    expect(res.status).toBe(401);
  });
});
