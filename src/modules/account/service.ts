import { z } from "zod";
import { hashPassword, verifyPassword } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { loadActiveSales } from "../catalog/pricing";
import { findListProducts } from "../catalog/repository";
import { toCard } from "../catalog/service";
import { publicUser } from "../auth/service";

export const profileBody = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  phone: z.string().trim().max(30).optional(),
});

export const passwordBody = z.object({
  current: z.string().optional(),
  next: z.string().min(8, "8 caractères minimum").max(200),
});

export const addressBody = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120),
  line1: z.string().trim().min(2, "Adresse requise").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "Ville requise").max(80),
  country: z.string().trim().min(2).max(60).default("Guinée"),
  phone: z.string().trim().min(6, "Téléphone requis").max(30),
  isDefault: z.boolean().default(false),
});

export const returnBody = z.object({
  orderNumber: z.number().int(),
  reason: z.string().trim().min(3, "Motif requis").max(1000),
  items: z.array(z.object({ orderItemId: z.string(), quantity: z.number().int().min(1) })).min(1, "Choisissez au moins un article"),
});

export async function me(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.deletedAt) throw AppError.unauthorized();
  return { ...publicUser(u), hasPassword: !!u.passwordHash };
}

export async function updateProfile(userId: string, input: z.infer<typeof profileBody>) {
  const u = await prisma.user.update({ where: { id: userId }, data: input });
  return publicUser(u);
}

export async function changePassword(userId: string, input: z.infer<typeof passwordBody>) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.passwordHash && !(input.current && (await verifyPassword(u.passwordHash, input.current)))) {
    throw AppError.badRequest("Mot de passe actuel incorrect", { current: ["Mot de passe actuel incorrect"] });
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.next) } });
}

// ---------------------------------------------------------------- Adresses

export const listAddresses = (userId: string) =>
  prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });

export async function saveAddress(userId: string, input: z.infer<typeof addressBody>, id?: string) {
  return prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) throw AppError.notFound("Adresse introuvable");
    }
    const count = await tx.address.count({ where: { userId } });
    const isDefault = input.isDefault || count === 0;
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return id
      ? tx.address.update({ where: { id }, data: { ...input, isDefault } })
      : tx.address.create({ data: { ...input, isDefault, userId } });
  });
}

export async function deleteAddress(userId: string, id: string) {
  const n = await prisma.address.deleteMany({ where: { id, userId } });
  if (n.count === 0) throw AppError.notFound("Adresse introuvable");
}

// ---------------------------------------------------------------- Favoris

export async function wishlist(userId: string) {
  const rows = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { productId: true } });
  const ids = rows.map((r) => r.productId);
  const [products, sales] = await Promise.all([findListProducts({ id: { in: ids } }), loadActiveSales()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.flatMap((id) => (byId.has(id) ? [toCard(byId.get(id)!, sales)] : []));
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) throw AppError.notFound("Produit introuvable");
  await prisma.wishlistItem.upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId }, update: {} });
}

export async function removeFromWishlist(userId: string, productId: string) {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
}

// ---------------------------------------------------------------- Retours

export const listReturns = (userId: string) =>
  prisma.returnRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { order: { select: { number: true } } } });

export async function requestReturn(userId: string, input: z.infer<typeof returnBody>) {
  const order = await prisma.order.findFirst({ where: { userId, number: input.orderNumber }, include: { items: true } });
  if (!order) throw AppError.notFound("Commande introuvable");
  if (order.status !== "DELIVERED") throw AppError.badRequest("Seules les commandes livrées peuvent faire l'objet d'un retour.");
  for (const i of input.items) {
    const line = order.items.find((l) => l.id === i.orderItemId);
    if (!line || i.quantity > line.quantity) throw AppError.badRequest("Article de retour invalide");
  }
  return prisma.returnRequest.create({ data: { orderId: order.id, userId, reason: input.reason, items: input.items } });
}
