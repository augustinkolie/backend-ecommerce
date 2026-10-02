import { prisma } from "@/src/lib/prisma";

export type ActiveSale = { categoryIds: Set<string>; percent: number; name: string };

/** Soldes par catégorie en cours (étendues aux sous-catégories). */
export async function loadActiveSales(now = new Date()): Promise<ActiveSale[]> {
  const [sales, categories] = await Promise.all([
    prisma.categorySale.findMany({ where: { startsAt: { lte: now }, endsAt: { gte: now } } }),
    prisma.category.findMany({ select: { id: true, parentId: true } }),
  ]);
  if (sales.length === 0) return [];
  const children = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    children.set(c.parentId, [...(children.get(c.parentId) ?? []), c.id]);
  }
  const expand = (id: string, acc = new Set<string>()) => {
    acc.add(id);
    for (const child of children.get(id) ?? []) expand(child, acc);
    return acc;
  };
  return sales.map((s) => ({ categoryIds: expand(s.categoryId), percent: s.percent, name: s.name }));
}

/**
 * Prix effectif d'une variante. Le prix est TOUJOURS recalculé côté serveur.
 * Une solde de catégorie s'applique sur le prix de base ; le prix barré devient le prix de base.
 */
export function effectivePrice(
  variant: { price: number; compareAtPrice: number | null },
  categoryId: string,
  sales: ActiveSale[],
) {
  const sale = sales
    .filter((s) => s.categoryIds.has(categoryId))
    .sort((a, b) => b.percent - a.percent)[0];
  if (!sale) return { price: variant.price, compareAtPrice: variant.compareAtPrice };
  const discounted = Math.round((variant.price * (100 - sale.percent)) / 100);
  return { price: discounted, compareAtPrice: Math.max(variant.compareAtPrice ?? 0, variant.price) };
}
