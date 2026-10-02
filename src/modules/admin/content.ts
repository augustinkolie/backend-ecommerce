import { z } from "zod";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { revalidateFrontend } from "@/src/lib/revalidate";
import { saveSettings, type ShopSettings } from "@/src/lib/settings";
import { Prisma } from "@/src/generated/prisma/client";
import { readHotspots } from "../content/service";

// ---------------------------------------------------------------- Bandeaux

export const blockBody = z.object({
  slot: z.enum(["home_hero", "home_collection"]),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(300).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  linkUrl: z.string().trim().max(300).nullable().optional(),
  linkLabel: z.string().trim().max(60).nullable().optional(),
  /** Une : 2 à 4 produits visibles sur la photo, position en % (0–100). */
  hotspots: z
    .array(z.object({ productId: z.string().min(1), x: z.number().min(0).max(100), y: z.number().min(0).max(100) }))
    .max(4)
    .nullable()
    .optional(),
  position: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

/** Bandeaux, avec pour la une le nom et la vignette des produits placés sur la photo (éditeur de points). */
export async function listBlocks() {
  const blocks = await prisma.contentBlock.findMany({ orderBy: [{ slot: "asc" }, { position: "asc" }] });
  const ids = blocks.flatMap((b) => readHotspots(b.hotspots).map((h) => h.productId));
  const products = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  return blocks.map((b) => ({
    ...b,
    hotspots: readHotspots(b.hotspots).map((h) => ({ ...h, name: byId.get(h.productId)?.name ?? "Produit supprimé", imageUrl: byId.get(h.productId)?.images[0]?.url ?? null })),
  }));
}

export async function saveBlock(input: z.infer<typeof blockBody>, author: AuthUser, id?: string) {
  const { hotspots, ...rest } = input;
  if (hotspots?.length) {
    const ids = [...new Set(hotspots.map((h) => h.productId))];
    if (ids.length !== hotspots.length) throw AppError.badRequest("Un produit ne peut apparaître qu'une fois sur la photo.");
    const found = await prisma.product.count({ where: { id: { in: ids }, deletedAt: null } });
    if (found !== ids.length) throw AppError.badRequest("Produit introuvable parmi les points de la photo.");
  }
  const data = { ...rest, ...(hotspots !== undefined ? { hotspots: hotspots ?? Prisma.DbNull } : {}) };
  const saved = id ? await prisma.contentBlock.update({ where: { id }, data }) : await prisma.contentBlock.create({ data });
  await audit(author, id ? "content.update" : "content.create", "ContentBlock", saved.id, undefined, saved);
  await revalidateFrontend(["home"]);
  return saved;
}

export async function deleteBlock(id: string, author: AuthUser) {
  const before = await prisma.contentBlock.delete({ where: { id } });
  await audit(author, "content.delete", "ContentBlock", id, before);
  await revalidateFrontend(["home"]);
}

// ---------------------------------------------------------------- Pages légales

export const pageBody = z.object({ title: z.string().trim().min(1).max(120), body: z.string().max(100_000) });

export const listPages = () => prisma.page.findMany({ orderBy: { slug: "asc" } });

export async function savePage(slug: string, input: z.infer<typeof pageBody>, author: AuthUser) {
  const before = await prisma.page.findUnique({ where: { slug } });
  const saved = await prisma.page.upsert({ where: { slug }, create: { slug, ...input }, update: input });
  await audit(author, "page.update", "Page", slug, before ?? undefined, saved);
  await revalidateFrontend([`page:${slug}`]);
  return saved;
}

// ---------------------------------------------------------------- Paramètres & livraison

export const settingsBody = z.object({
  shopName: z.string().trim().min(1).max(80).optional(),
  currency: z.enum(["GNF", "EUR", "XOF", "USD"]).optional(),
  locale: z.string().optional(),
  taxRate: z.number().int().min(0).max(1000).optional(),
  pricesIncludeTax: z.boolean().optional(),
  paymentMethods: z.array(z.object({ code: z.string(), label: z.string().min(1), enabled: z.boolean() })).optional(),
  contactEmail: z.email().optional(),
  contactPhone: z.string().max(40).optional(),
  address: z.string().max(200).optional(),
  freeShippingThreshold: z.number().int().min(0).nullable().optional(),
  emails: z.object({ abandonedCart: z.boolean(), reviewRequest: z.boolean(), backInStock: z.boolean() }).optional(),
});

export async function updateSettings(input: z.infer<typeof settingsBody>, author: AuthUser) {
  const saved = await saveSettings(input as Partial<ShopSettings>);
  await audit(author, "settings.update", "Setting", "shop", undefined, input);
  await revalidateFrontend(["settings", "catalog", "home"]);
  return saved;
}

export const zoneBody = z.object({
  name: z.string().trim().min(1).max(80),
  cities: z.array(z.string().trim().min(1)).default([]),
  price: z.number().int().min(0),
  freeAbove: z.number().int().min(0).nullable().optional(),
  isPickup: z.boolean().default(false),
  delay: z.string().max(60).nullable().optional(),
  position: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const listZonesAdmin = () => prisma.shippingZone.findMany({ orderBy: { position: "asc" } });

export async function saveZone(input: z.infer<typeof zoneBody>, author: AuthUser, id?: string) {
  const saved = id ? await prisma.shippingZone.update({ where: { id }, data: input }) : await prisma.shippingZone.create({ data: input });
  await audit(author, id ? "zone.update" : "zone.create", "ShippingZone", saved.id, undefined, saved);
  await revalidateFrontend(["settings"]);
  return saved;
}

export async function deleteZone(id: string, author: AuthUser) {
  const used = await prisma.order.count({ where: { shippingZoneId: id } });
  if (used) {
    await prisma.shippingZone.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.shippingZone.delete({ where: { id } }).catch(() => {
      throw AppError.notFound("Zone introuvable");
    });
  }
  await audit(author, "zone.delete", "ShippingZone", id);
  await revalidateFrontend(["settings"]);
}
