import type { Prisma } from "@/src/generated/prisma/client";
import { prisma } from "@/src/lib/prisma";

export const publishedWhere = (): Prisma.ProductWhereInput => ({
  deletedAt: null,
  OR: [
    { status: "PUBLISHED" },
    { status: "SCHEDULED", publishedAt: { lte: new Date() } },
  ],
});

/** Sélection allégée pour les listes (cartes produit + facettes). */
export const listSelect = {
  id: true,
  slug: true,
  name: true,
  family: true,
  material: true,
  categoryId: true,
  publishedAt: true,
  createdAt: true,
  variants: {
    where: { deletedAt: null },
    select: {
      id: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      stockReserved: true,
      attributeValues: { select: { id: true, value: true, hex: true, position: true, type: { select: { code: true } } } },
      _count: { select: { orderItems: true } },
    },
  },
  images: { orderBy: { position: "asc" }, take: 2, select: { url: true, alt: true } },
} satisfies Prisma.ProductSelect;

export type ListProduct = Prisma.ProductGetPayload<{ select: typeof listSelect }>;

export async function findListProducts(where: Prisma.ProductWhereInput) {
  return prisma.product.findMany({ where: { ...publishedWhere(), ...where }, select: listSelect });
}

export async function findCategories() {
  return prisma.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
}

export async function findProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, ...publishedWhere() },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, include: { colorValue: { select: { value: true } } } },
      variants: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { attributeValues: { include: { type: true } } },
      },
    },
  });
}

export async function reviewSummary(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: true,
  });
  return { average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, count: agg._count };
}

export async function findVariantStock(productId: string) {
  return prisma.productVariant.findMany({
    where: { productId, deletedAt: null },
    select: { id: true, stock: true, stockReserved: true, lowStockAlert: true },
  });
}
