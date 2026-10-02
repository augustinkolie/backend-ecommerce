import { prisma } from "@/src/lib/prisma";
import { clearIndex, indexProducts, removeProducts, searchProducts, type ProductDocument } from "@/src/lib/search";
import { loadActiveSales } from "../catalog/pricing";
import { findListProducts, publishedWhere } from "../catalog/repository";
import { toCard } from "../catalog/service";

/** Recherche instantanée (dès 2 caractères) : Meilisearch, repli SQL si indisponible. Pagination par numéro de page. */
export async function search(q: string, limit: number, page = 1) {
  const term = q.trim();
  const offset = (page - 1) * limit;
  const pageInfo = (total: number) => ({ page, pageCount: Math.max(1, Math.ceil(total / limit)) });
  if (term.length < 2) return { items: [], total: 0, ...pageInfo(0), engine: "none" as const };

  const hits = await searchProducts(term, limit, offset);
  const sales = await loadActiveSales();
  if (hits) {
    const ids = hits.hits.map((h) => h.id);
    const products = await findListProducts({ id: { in: ids } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = ids.flatMap((id) => (byId.has(id) ? [toCard(byId.get(id)!, sales)] : []));
    return { items, total: hits.total, ...pageInfo(hits.total), engine: "meilisearch" as const };
  }

  const products = await findListProducts({
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { material: { contains: term, mode: "insensitive" } },
      { category: { name: { contains: term, mode: "insensitive" } } },
    ],
  });
  return { items: products.slice(offset, offset + limit).map((p) => toCard(p, sales)), total: products.length, ...pageInfo(products.length), engine: "sql" as const };
}

/** (Ré)indexe des produits (tous si `ids` est absent) ; les produits non publiés sont retirés de l'index. */
export async function syncProducts(ids?: string[]) {
  const rows = await prisma.product.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { deletedAt: null }, include: { attributeValues: { include: { type: true } } } },
    },
  });
  const published = await prisma.product.findMany({ where: { ...publishedWhere(), ...(ids ? { id: { in: ids } } : {}) }, select: { id: true } });
  const publishedIds = new Set(published.map((p) => p.id));

  const docs: ProductDocument[] = rows
    .filter((p) => publishedIds.has(p.id))
    .map((p) => {
      const prices = p.variants.map((v) => v.price);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        family: p.family,
        category: p.category.name,
        material: p.material,
        colors: [...new Set(p.variants.flatMap((v) => v.attributeValues.filter((a) => a.type.code === "color").map((a) => a.value)))],
        price: prices.length ? Math.min(...prices) : 0,
        compareAtPrice: null,
        imageUrl: p.images[0]?.url ?? null,
        publishedAt: (p.publishedAt ?? p.createdAt).getTime(),
      };
    });
  // Réindexation complète : on repart d'un index vide (ex. après un nouveau seed, les anciens ids n'existent plus).
  if (!ids) await clearIndex();
  await indexProducts(docs);
  await removeProducts(rows.filter((p) => !publishedIds.has(p.id)).map((p) => p.id));
  return docs.length;
}
