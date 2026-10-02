import { z } from "zod";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { revalidateFrontend } from "@/src/lib/revalidate";

export const couponBody = z
  .object({
    code: z.string().trim().min(3, "3 caractères minimum").max(40).transform((v) => v.toUpperCase().replace(/\s+/g, "")),
    type: z.enum(["PERCENT", "AMOUNT", "FREE_SHIPPING"]),
    value: z.number().int().min(0),
    minimum: z.number().int().min(0).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    maxUses: z.number().int().min(1).nullable().optional(),
  })
  .refine((c) => c.type !== "PERCENT" || (c.value > 0 && c.value <= 100), { message: "Pourcentage entre 1 et 100", path: ["value"] })
  .refine((c) => !c.startsAt || !c.endsAt || c.startsAt < c.endsAt, { message: "La fin doit suivre le début", path: ["endsAt"] });

export const saleBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    categoryId: z.string().min(1, "Catégorie requise"),
    percent: z.number().int().min(1).max(90),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((s) => s.startsAt < s.endsAt, { message: "La fin doit suivre le début", path: ["endsAt"] });

export const listCoupons = () => prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

export async function saveCoupon(input: z.infer<typeof couponBody>, author: AuthUser, id?: string) {
  const clash = await prisma.coupon.findFirst({ where: { code: input.code, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw AppError.conflict("Ce code existe déjà.");
  const data = { ...input, minimum: input.minimum ?? null, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, maxUses: input.maxUses ?? null };
  const saved = id ? await prisma.coupon.update({ where: { id }, data }) : await prisma.coupon.create({ data });
  await audit(author, id ? "coupon.update" : "coupon.create", "Coupon", saved.id, undefined, saved);
  return saved;
}

export async function deleteCoupon(id: string, author: AuthUser) {
  const used = await prisma.order.count({ where: { couponId: id } });
  if (used) {
    // Historique conservé : on désactive au lieu de supprimer.
    const c = await prisma.coupon.update({ where: { id }, data: { endsAt: new Date() } });
    await audit(author, "coupon.disable", "Coupon", id, undefined, c);
    return { disabled: true };
  }
  const before = await prisma.coupon.delete({ where: { id } });
  await audit(author, "coupon.delete", "Coupon", id, before);
  return { deleted: true };
}

export const listSales = () => prisma.categorySale.findMany({ orderBy: { startsAt: "desc" }, include: { category: { select: { name: true } } } });

export async function saveSale(input: z.infer<typeof saleBody>, author: AuthUser, id?: string) {
  const saved = id ? await prisma.categorySale.update({ where: { id }, data: input }) : await prisma.categorySale.create({ data: input });
  await audit(author, id ? "sale.update" : "sale.create", "CategorySale", saved.id, undefined, saved);
  await revalidateFrontend(["catalog"]);
  return saved;
}

export async function deleteSale(id: string, author: AuthUser) {
  const before = await prisma.categorySale.delete({ where: { id } });
  await audit(author, "sale.delete", "CategorySale", id, before);
  await revalidateFrontend(["catalog"]);
}
