import { z } from "zod";
import type { Prisma } from "@/src/generated/prisma/client";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { paginateArray, prismaPage, toPage } from "@/src/lib/pagination";
import { prisma } from "@/src/lib/prisma";
import { revalidateFrontend } from "@/src/lib/revalidate";
import { slugify } from "@/src/lib/slug";
import { syncProducts } from "../search/service";

const family = z.enum(["LINEN", "CLOTHING", "TSHIRT", "SHOES"]);
const status = z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]);

export const productListQuery = z.object({
  q: z.string().optional(),
  status: status.optional(),
  family: family.optional(),
  categoryId: z.string().optional(),
  lowStock: z.enum(["1"]).optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const variantInput = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, "SKU requis").max(60),
  price: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).default(0),
  lowStockAlert: z.number().int().min(0).default(3),
  weightGrams: z.number().int().min(0).nullable().optional(),
  attributeValueIds: z.array(z.string()).default([]),
});

const imageInput = z.object({
  id: z.string().optional(),
  url: z.string().min(1),
  alt: z.string().trim().max(200).default(""),
  colorValueId: z.string().nullable().optional(),
});

export const productBody = z.object({
  name: z.string().trim().min(2, "Nom requis").max(160),
  slug: z.string().trim().max(90).optional(),
  description: z.string().trim().max(10_000).default(""),
  family,
  categoryId: z.string().min(1, "Catégorie requise"),
  material: z.string().trim().max(120).nullable().optional(),
  care: z.string().trim().max(2000).nullable().optional(),
  details: z.record(z.string(), z.string()).default({}),
  status: status.default("DRAFT"),
  publishedAt: z.coerce.date().nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
  collectionIds: z.array(z.string()).default([]),
  variants: z.array(variantInput).max(300).default([]),
  images: z.array(imageInput).max(40).default([]),
});

export type ProductInput = z.infer<typeof productBody>;

export const bulkBody = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum(["publish", "draft", "archive", "delete"]),
});

const detailInclude = {
  category: true,
  collections: { select: { id: true, name: true } },
  images: { orderBy: { position: "asc" } },
  variants: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { attributeValues: { include: { type: true } } },
  },
} satisfies Prisma.ProductInclude;

export async function listProducts(q: z.infer<typeof productListQuery>) {
  const where: Prisma.ProductWhereInput = { deletedAt: null };
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { slug: { contains: q.q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q.q, mode: "insensitive" } } } },
    ];
  }
  if (q.status) where.status = q.status;
  if (q.family) where.family = q.family;
  if (q.categoryId) where.categoryId = q.categoryId;
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      // Le filtre « stock bas » compare deux colonnes : il est appliqué en mémoire, sur toute la liste.
      ...(q.lowStock ? {} : prismaPage(q, q.limit)),
      include: {
        category: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { where: { deletedAt: null }, select: { price: true, stock: true, stockReserved: true, lowStockAlert: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  const items = rows.map((p) => {
    const prices = p.variants.map((v) => v.price);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      family: p.family,
      status: p.status,
      category: p.category.name,
      imageUrl: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
      stock: p.variants.reduce((n, v) => n + v.stock, 0),
      lowStock: p.variants.some((v) => v.stock - v.stockReserved <= v.lowStockAlert),
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,
      updatedAt: p.updatedAt,
    };
  });
  if (q.lowStock) return paginateArray(items.filter((i) => i.lowStock), q, q.limit);
  return toPage(items, q.limit, total, q.page);
}

export async function getProduct(id: string) {
  const p = await prisma.product.findFirst({ where: { id, deletedAt: null }, include: detailInclude });
  if (!p) throw AppError.notFound("Produit introuvable");
  return {
    ...p,
    variants: p.variants.map((v) => ({ ...v, attributeValueIds: v.attributeValues.map((a) => a.id) })),
  };
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "produit";
  let slug = root;
  for (let i = 2; ; i++) {
    const clash = await prisma.product.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    if (!clash) return slug;
    slug = `${root}-${i}`;
  }
}

async function checkSkus(variants: ProductInput["variants"], productId?: string) {
  const skus = variants.map((v) => v.sku.toUpperCase());
  const dup = skus.find((s, i) => skus.indexOf(s) !== i);
  if (dup) throw AppError.badRequest(`SKU en double : ${dup}`);
  const clash = await prisma.productVariant.findFirst({
    where: { sku: { in: variants.map((v) => v.sku) }, ...(productId ? { productId: { not: productId } } : {}) },
  });
  if (clash) throw AppError.conflict(`Le SKU ${clash.sku} est déjà utilisé par un autre produit.`);
}

/** Création ou mise à jour « en une page » : produit + variantes + images, dans une transaction. */
export async function saveProduct(input: ProductInput, author: AuthUser, id?: string) {
  const before = id ? await getProduct(id) : null;
  await checkSkus(input.variants, id);
  const slug = await uniqueSlug(input.slug || input.name, id);
  const publishedAt =
    input.status === "PUBLISHED" ? (input.publishedAt ?? before?.publishedAt ?? new Date()) : input.status === "SCHEDULED" ? input.publishedAt : (input.publishedAt ?? null);
  if (input.status === "SCHEDULED" && !publishedAt) throw AppError.badRequest("Date de publication requise", { publishedAt: ["Date requise"] });

  const data = {
    name: input.name,
    slug,
    description: input.description,
    family: input.family,
    material: input.material ?? null,
    care: input.care ?? null,
    details: input.details,
    status: input.status,
    publishedAt,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    category: { connect: { id: input.categoryId } },
    collections: { set: input.collectionIds.map((cid) => ({ id: cid })) },
  };

  const saved = await prisma.$transaction(async (tx) => {
    const product = id
      ? await tx.product.update({ where: { id }, data })
      : await tx.product.create({ data: { ...data, collections: { connect: input.collectionIds.map((cid) => ({ id: cid })) } } });

    // Variantes : mise à jour, création, suppression logique des absentes.
    const keep = new Set<string>();
    for (const v of input.variants) {
      const values = { set: v.attributeValueIds.map((vid) => ({ id: vid })) };
      if (v.id) {
        const prev = await tx.productVariant.findFirst({ where: { id: v.id, productId: product.id } });
        if (!prev) throw AppError.badRequest("Variante inconnue");
        await tx.productVariant.update({
          where: { id: v.id },
          data: { sku: v.sku, price: v.price, compareAtPrice: v.compareAtPrice ?? null, stock: v.stock, lowStockAlert: v.lowStockAlert, weightGrams: v.weightGrams ?? null, attributeValues: values, deletedAt: null },
        });
        if (prev.stock !== v.stock) {
          await tx.stockMovement.create({ data: { variantId: v.id, type: "ADJUSTMENT", quantity: v.stock - prev.stock, reason: "Édition produit", authorId: author.id } });
        }
        keep.add(v.id);
      } else {
        const created = await tx.productVariant.create({
          data: { productId: product.id, sku: v.sku, price: v.price, compareAtPrice: v.compareAtPrice ?? null, stock: v.stock, lowStockAlert: v.lowStockAlert, weightGrams: v.weightGrams ?? null, attributeValues: { connect: v.attributeValueIds.map((vid) => ({ id: vid })) } },
        });
        if (v.stock > 0) {
          await tx.stockMovement.create({ data: { variantId: created.id, type: "IN", quantity: v.stock, reason: "Stock initial", authorId: author.id } });
        }
        keep.add(created.id);
      }
    }
    await tx.productVariant.updateMany({ where: { productId: product.id, id: { notIn: [...keep] }, deletedAt: null }, data: { deletedAt: new Date() } });

    // Images : remplacées dans l'ordre reçu.
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (input.images.length) {
      await tx.productImage.createMany({
        data: input.images.map((img, position) => ({ productId: product.id, url: img.url, alt: img.alt || input.name, position, colorValueId: img.colorValueId ?? null })),
      });
    }
    await audit(author, id ? "product.update" : "product.create", "Product", product.id, before ?? undefined, { ...input, slug }, tx);
    return product;
  });

  await afterCatalogChange([saved.id]);
  return getProduct(saved.id);
}

export async function duplicateProduct(id: string, author: AuthUser) {
  const p = await getProduct(id);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return saveProduct(
    {
      name: `${p.name} (copie)`,
      description: p.description,
      family: p.family,
      categoryId: p.categoryId,
      material: p.material,
      care: p.care,
      details: (p.details ?? {}) as Record<string, string>,
      status: "DRAFT",
      publishedAt: null,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      collectionIds: p.collections.map((c) => c.id),
      variants: p.variants.map((v) => ({ sku: `${v.sku}-${suffix}`, price: v.price, compareAtPrice: v.compareAtPrice, stock: 0, lowStockAlert: v.lowStockAlert, weightGrams: v.weightGrams, attributeValueIds: v.attributeValueIds })),
      images: p.images.map((i) => ({ url: i.url, alt: i.alt, colorValueId: i.colorValueId })),
    },
    author,
  );
}

export async function bulkProducts(input: z.infer<typeof bulkBody>, author: AuthUser) {
  const data: Prisma.ProductUpdateManyMutationInput =
    input.action === "delete"
      ? { deletedAt: new Date(), status: "ARCHIVED" }
      : input.action === "publish"
        ? { status: "PUBLISHED" }
        : input.action === "draft"
          ? { status: "DRAFT" }
          : { status: "ARCHIVED" };
  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { id: { in: input.ids } }, data });
    if (input.action === "publish") {
      await tx.product.updateMany({ where: { id: { in: input.ids }, publishedAt: null }, data: { publishedAt: new Date() } });
    }
    for (const pid of input.ids) await audit(author, `product.${input.action}`, "Product", pid, undefined, { action: input.action }, tx);
  });
  await afterCatalogChange(input.ids);
  return { updated: input.ids.length };
}

export async function afterCatalogChange(productIds: string[]) {
  await Promise.all([
    syncProducts(productIds),
    revalidateFrontend(["catalog", ...productIds.map((pid) => `product:${pid}`)]),
  ]);
}
