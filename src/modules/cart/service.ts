import type { Prisma } from "@/src/generated/prisma/client";
import { getAuth, randomToken } from "@/src/lib/auth";
import { COOKIE, readCookie, serializeCookie } from "@/src/lib/cookies";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { getSettings } from "@/src/lib/settings";
import { effectivePrice, loadActiveSales } from "../catalog/pricing";
import { couponDiscount, couponProblem, findValidCoupon } from "../coupons/service";
import { listZones, shippingPrice, zoneForCity } from "../shipping/service";

const GUEST_TTL = 30 * 24 * 3600; // panier invité : 30 jours

const cartInclude = {
  coupon: true,
  items: {
    orderBy: { id: "asc" },
    include: {
      variant: {
        include: {
          attributeValues: { include: { type: true } },
          product: {
            select: {
              id: true, slug: true, name: true, family: true, categoryId: true, status: true, deletedAt: true,
              images: { orderBy: { position: "asc" }, include: { colorValue: { select: { value: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** Panier courant : celui de l'utilisateur connecté, sinon celui du cookie invité. */
export async function resolveCart(req: Request, create: boolean) {
  const auth = await getAuth(req);
  const headers = new Headers();
  if (auth) {
    let cart = await prisma.cart.findFirst({ where: { userId: auth.id }, orderBy: { updatedAt: "desc" }, include: cartInclude });
    if (!cart && create) cart = await prisma.cart.create({ data: { userId: auth.id }, include: cartInclude });
    return { cart, headers, userId: auth.id };
  }
  const sessionId = readCookie(req, COOKIE.cart);
  let cart = sessionId ? await prisma.cart.findUnique({ where: { sessionId }, include: cartInclude }) : null;
  if (!cart && create) {
    const sid = randomToken();
    cart = await prisma.cart.create({ data: { sessionId: sid }, include: cartInclude });
    headers.append("set-cookie", serializeCookie(COOKIE.cart, sid, GUEST_TTL));
  }
  return { cart, headers, userId: null };
}

/** Fusionne le panier invité dans celui du compte à la connexion. */
export async function mergeGuestCart(sessionId: string, userId: string) {
  const guest = await prisma.cart.findUnique({ where: { sessionId }, include: { items: true } });
  if (!guest) return;
  if (guest.items.length === 0) {
    await prisma.cart.delete({ where: { id: guest.id } });
    return;
  }
  const userCart =
    (await prisma.cart.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })) ??
    (await prisma.cart.create({ data: { userId } }));
  await prisma.$transaction(async (tx) => {
    for (const item of guest.items) {
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        create: { cartId: userCart.id, variantId: item.variantId, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      });
    }
    if (guest.couponId && !userCart.couponId) await tx.cart.update({ where: { id: userCart.id }, data: { couponId: guest.couponId } });
    await tx.cart.delete({ where: { id: guest.id } });
  });
}

/** Vue du panier avec prix recalculés côté serveur. */
export async function viewCart(cart: CartWithItems | null, city?: string | null) {
  const [settings, sales, zones] = await Promise.all([getSettings(), loadActiveSales(), listZones()]);
  const items = (cart?.items ?? [])
    .filter((i) => !i.variant.deletedAt && !i.variant.product.deletedAt)
    .map((i) => {
      const v = i.variant;
      const { price, compareAtPrice } = effectivePrice(v, v.product.categoryId, sales);
      const color = v.attributeValues.find((a) => a.type.code === "color")?.value;
      const image = v.product.images.find((img) => color && img.colorValue?.value === color) ?? v.product.images[0];
      const available = Math.max(0, v.stock - v.stockReserved);
      return {
        id: i.id,
        variantId: v.id,
        productId: v.product.id,
        slug: v.product.slug,
        name: v.product.name,
        family: v.product.family,
        sku: v.sku,
        attributes: v.attributeValues
          .sort((a, b) => a.type.position - b.type.position)
          .map((a) => ({ code: a.type.code, name: a.type.name, value: a.value })),
        imageUrl: image?.url ?? null,
        unitPrice: price,
        compareAtPrice,
        quantity: i.quantity,
        available,
        lineTotal: price * i.quantity,
      };
    });

  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  const coupon = cart?.coupon && !couponProblem(cart.coupon, subtotal) ? cart.coupon : null;
  const discount = couponDiscount(coupon, subtotal);
  const zone = zoneForCity(zones, city);
  const threshold = zone?.freeAbove ?? settings.freeShippingThreshold;
  const shipping = items.length ? shippingPrice(zone, subtotal - discount, settings.freeShippingThreshold, coupon?.type === "FREE_SHIPPING") : 0;

  return {
    id: cart?.id ?? null,
    currency: settings.currency,
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
    discount,
    shippingEstimate: shipping,
    shippingZone: zone ? { id: zone.id, name: zone.name } : null,
    freeShippingThreshold: threshold,
    freeShippingRemaining: threshold != null ? Math.max(0, threshold - (subtotal - discount)) : null,
    total: Math.max(0, subtotal - discount + shipping),
  };
}

export async function getCartView(req: Request, city?: string | null) {
  const { cart, headers } = await resolveCart(req, false);
  return { view: await viewCart(cart, city), headers };
}

async function reload(cartId: string) {
  return prisma.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
}

export async function addItem(req: Request, variantId: string, quantity: number) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, deletedAt: null, product: { deletedAt: null } },
  });
  if (!variant) throw AppError.notFound("Article introuvable");
  const available = variant.stock - variant.stockReserved;
  if (available <= 0) throw AppError.conflict("Cet article est épuisé.");

  const { cart, headers } = await resolveCart(req, true);
  const current = cart!.items.find((i) => i.variantId === variantId)?.quantity ?? 0;
  const next = Math.min(current + quantity, available, 20);
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart!.id, variantId } },
    create: { cartId: cart!.id, variantId, quantity: next },
    update: { quantity: next },
  });
  await prisma.cart.update({ where: { id: cart!.id }, data: { reminderSentAt: null } });
  return { view: await viewCart(await reload(cart!.id)), headers };
}

async function ownedItem(req: Request, itemId: string) {
  const { cart, headers } = await resolveCart(req, false);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw AppError.notFound("Ligne de panier introuvable");
  return { cart, item, headers };
}

export async function updateItem(req: Request, itemId: string, quantity: number) {
  const { cart, item, headers } = await ownedItem(req, itemId);
  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    const available = item.variant.stock - item.variant.stockReserved;
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: Math.max(1, Math.min(quantity, available, 20)) } });
  }
  return { view: await viewCart(await reload(cart.id)), headers };
}

export async function removeItem(req: Request, itemId: string) {
  return updateItem(req, itemId, 0);
}

export async function applyCoupon(req: Request, code: string) {
  const { cart, headers } = await resolveCart(req, true);
  const view = await viewCart(cart);
  const coupon = await findValidCoupon(code, view.subtotal);
  await prisma.cart.update({ where: { id: cart!.id }, data: { couponId: coupon.id } });
  return { view: await viewCart(await reload(cart!.id)), headers };
}

export async function removeCoupon(req: Request) {
  const { cart, headers } = await resolveCart(req, false);
  if (cart) await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
  return { view: await viewCart(cart ? await reload(cart.id) : null), headers };
}

export async function clearCart(cartId: string) {
  await prisma.cart.update({ where: { id: cartId }, data: { couponId: null, items: { deleteMany: {} } } });
}
