import type { Category, Prisma } from "@/src/generated/prisma/client";
import { AppError } from "@/src/lib/errors";
import { memo } from "@/src/lib/memo";
import { paginateArray } from "@/src/lib/pagination";
import { prisma } from "@/src/lib/prisma";
import { effectivePrice, loadActiveSales, type ActiveSale } from "./pricing";
import * as repo from "./repository";
import { FACET_CODES, type FacetCode, type ProductListQuery } from "./schema";

const NEW_DAYS = 30;
/** Durée de vie du cache mémoire du catalogue public ; vidé à chaque modification admin. */
const CATALOG_TTL = 60_000;

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  family: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  hoverImageUrl: string | null;
  colors: { value: string; hex: string | null }[];
  isNew: boolean;
  inStock: boolean;
};

// ---------------------------------------------------------------- Catégories

export type CategoryNode = Pick<Category, "id" | "name" | "slug" | "image" | "position" | "parentId"> & {
  path: string[];
  children: CategoryNode[];
};

export function categoryTree() {
  return memo("catalog:categories", CATALOG_TTL, buildCategoryTree);
}

async function buildCategoryTree() {
  const rows = await repo.findCategories();
  const byId = new Map<string, CategoryNode>();
  for (const c of rows) {
    byId.set(c.id, { id: c.id, name: c.name, slug: c.slug, image: c.image, position: c.position, parentId: c.parentId, path: [], children: [] });
  }
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const setPath = (n: CategoryNode, prefix: string[]) => {
    n.path = [...prefix, n.slug];
    n.children.forEach((c) => setPath(c, n.path));
  };
  roots.forEach((r) => setPath(r, []));
  return { roots, byId };
}

function descendants(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(descendants)];
}

// ---------------------------------------------------------------- Cartes produit

export function toCard(p: repo.ListProduct, sales: ActiveSale[]): ProductCard {
  const priced = p.variants.map((v) => ({ v, ...effectivePrice(v, p.categoryId, sales) }));
  const cheapest = priced.sort((a, b) => a.price - b.price)[0];
  const colorMap = new Map<string, { value: string; hex: string | null; position: number }>();
  for (const v of p.variants) {
    for (const av of v.attributeValues) {
      if (av.type.code === "color") colorMap.set(av.id, { value: av.value, hex: av.hex, position: av.position });
    }
  }
  const publishedAt = p.publishedAt ?? p.createdAt;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    family: p.family,
    price: cheapest?.price ?? 0,
    compareAtPrice: cheapest?.compareAtPrice && cheapest.compareAtPrice > cheapest.price ? cheapest.compareAtPrice : null,
    imageUrl: p.images[0]?.url ?? null,
    imageAlt: p.images[0]?.alt ?? null,
    hoverImageUrl: p.images[1]?.url ?? null,
    colors: [...colorMap.values()].sort((a, b) => a.position - b.position).map(({ value, hex }) => ({ value, hex })),
    isNew: Date.now() - publishedAt.getTime() < NEW_DAYS * 86400_000,
    inStock: p.variants.some((v) => v.stock - v.stockReserved > 0),
  };
}

// ---------------------------------------------------------------- Liste + facettes

type Facet = { code: string; label: string; values: { value: string; label: string; hex?: string | null; count: number }[] };

const FACET_LABELS: Record<FacetCode | "material", string> = {
  size: "Taille",
  shoe_size: "Pointure",
  dimension: "Dimension",
  color: "Couleur",
  material: "Matière",
};

function productValues(p: repo.ListProduct, code: FacetCode) {
  const set = new Set<string>();
  for (const v of p.variants) for (const av of v.attributeValues) if (av.type.code === code) set.add(av.value);
  return set;
}

/**
 * Catalogue publié complet (produits, soldes actives, cartes), partagé par les listes,
 * l'accueil et les produits associés : une requête SQL par minute au plus, au lieu d'une par visite.
 */
export function catalogSnapshot() {
  return memo("catalog:list", CATALOG_TTL, async () => {
    const [products, sales] = await Promise.all([repo.findListProducts({}), loadActiveSales()]);
    return { products, sales, cards: new Map(products.map((p) => [p.id, toCard(p, sales)])) };
  });
}

/** Produits d'une collection (manuelle : liste ; automatique : règles), mis en cache comme le catalogue. */
function collectionProductIds(slug: string) {
  return memo(`catalog:collection:${slug}`, CATALOG_TTL, async () => {
    const collection = await prisma.collection.findUnique({ where: { slug } });
    if (!collection) throw AppError.notFound("Collection introuvable");
    const where: Prisma.ProductWhereInput = collection.type === "MANUAL" ? { collections: { some: { id: collection.id } } } : collectionRuleWhere(collection.rules);
    const rows = await prisma.product.findMany({ where, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  });
}

export async function listProducts(q: ProductListQuery) {
  let category: CategoryNode | undefined;
  let inCategory: Set<string> | undefined;

  if (q.category) {
    const { byId } = await categoryTree();
    category = [...byId.values()].find((c) => c.slug === q.category);
    if (!category) throw AppError.notFound("Catégorie introuvable");
    inCategory = new Set(descendants(category));
  }
  const inCollection = q.collection ? await collectionProductIds(q.collection) : undefined;

  const snapshot = await catalogSnapshot();
  const { cards } = snapshot;
  const products = snapshot.products.filter(
    (p) => (!inCategory || inCategory.has(p.categoryId)) && (!inCollection || inCollection.has(p.id)) && (!q.family || p.family === q.family),
  );

  const selected: Record<FacetCode, string[]> = { size: q.size, shoe_size: q.shoe_size, dimension: q.dimension, color: q.color };

  // Chaque filtre est testé séparément pour calculer des compteurs « disjonctifs ».
  const passes = (p: repo.ListProduct, skip?: string) => {
    for (const code of FACET_CODES) {
      if (code === skip || selected[code].length === 0) continue;
      const vals = productValues(p, code);
      if (!selected[code].some((s) => vals.has(s))) return false;
    }
    if (skip !== "material" && q.material.length && !q.material.includes(p.material ?? "")) return false;
    const card = cards.get(p.id)!;
    if (skip !== "price") {
      if (q.price_min !== undefined && card.price < q.price_min) return false;
      if (q.price_max !== undefined && card.price > q.price_max) return false;
    }
    if (q.on_sale && !card.compareAtPrice) return false;
    return true;
  };

  const facets: Facet[] = [];
  for (const code of FACET_CODES) {
    const counts = new Map<string, { count: number; hex: string | null; position: number }>();
    for (const p of products) {
      if (!passes(p, code)) continue;
      const seen = new Set<string>();
      for (const v of p.variants) {
        for (const av of v.attributeValues) {
          if (av.type.code !== code || seen.has(av.value)) continue;
          seen.add(av.value);
          const cur = counts.get(av.value) ?? { count: 0, hex: av.hex, position: av.position };
          cur.count++;
          counts.set(av.value, cur);
        }
      }
    }
    if (counts.size === 0) continue;
    facets.push({
      code,
      label: FACET_LABELS[code],
      values: [...counts.entries()]
        .sort((a, b) => a[1].position - b[1].position || a[0].localeCompare(b[0], "fr", { numeric: true }))
        .map(([value, c]) => ({ value, label: value, hex: code === "color" ? c.hex : undefined, count: c.count })),
    });
  }
  const materials = new Map<string, number>();
  for (const p of products) if (p.material && passes(p, "material")) materials.set(p.material, (materials.get(p.material) ?? 0) + 1);
  if (materials.size) {
    facets.push({
      code: "material",
      label: FACET_LABELS.material,
      values: [...materials.entries()].sort().map(([value, count]) => ({ value, label: value, count })),
    });
  }

  const matching = products.filter((p) => passes(p));
  const prices = matching.map((p) => cards.get(p.id)!.price);
  const sorted = sortProducts(matching, q.sort, cards);
  const page = paginateArray(sorted.map((p) => cards.get(p.id)!), q, q.limit);

  return {
    ...page,
    facets,
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    category: category ? { id: category.id, name: category.name, slug: category.slug, path: category.path } : null,
  };
}

function sortProducts(list: repo.ListProduct[], sort: ProductListQuery["sort"], cards: Map<string, ProductCard>) {
  const sales = (p: repo.ListProduct) => p.variants.reduce((n, v) => n + v._count.orderItems, 0);
  const date = (p: repo.ListProduct) => (p.publishedAt ?? p.createdAt).getTime();
  const copy = [...list];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => cards.get(a.id)!.price - cards.get(b.id)!.price);
    case "price_desc":
      return copy.sort((a, b) => cards.get(b.id)!.price - cards.get(a.id)!.price);
    case "best":
      return copy.sort((a, b) => sales(b) - sales(a) || date(b) - date(a));
    default:
      return copy.sort((a, b) => date(b) - date(a));
  }
}

/** Règles de collection automatique : { family?, categorySlug?, onSale?, newDays?, material? } */
export function collectionRuleWhere(rules: unknown): Prisma.ProductWhereInput {
  const r = (rules ?? {}) as { family?: string; material?: string; newDays?: number; minPrice?: number; maxPrice?: number };
  const where: Prisma.ProductWhereInput = {};
  if (r.family) where.family = r.family as Prisma.ProductWhereInput["family"];
  if (r.material) where.material = r.material;
  if (r.newDays) where.publishedAt = { gte: new Date(Date.now() - r.newDays * 86400_000) };
  if (r.minPrice || r.maxPrice) {
    where.variants = { some: { deletedAt: null, price: { gte: r.minPrice ?? 0, lte: r.maxPrice ?? Number.MAX_SAFE_INTEGER } } };
  }
  return where;
}

// ---------------------------------------------------------------- Fiche produit

/** Fiche produit (hors stock, lu en temps réel par getStock), mise en cache comme le catalogue. */
export function getProduct(slug: string) {
  return memo(`catalog:product:${slug}`, CATALOG_TTL, () => loadProduct(slug));
}

async function loadProduct(slug: string) {
  const p = await repo.findProductBySlug(slug);
  if (!p) throw AppError.notFound("Produit introuvable");
  const [{ sales, products }, reviews, { byId }] = await Promise.all([catalogSnapshot(), repo.reviewSummary(p.id), categoryTree()]);

  // Dimensions de variante, dans l'ordre des types d'attributs.
  const dims = new Map<string, { code: string; name: string; position: number; values: Map<string, { value: string; hex: string | null; position: number }> }>();
  for (const v of p.variants) {
    for (const av of v.attributeValues) {
      const d = dims.get(av.type.code) ?? { code: av.type.code, name: av.type.name, position: av.type.position, values: new Map() };
      d.values.set(av.value, { value: av.value, hex: av.hex, position: av.position });
      dims.set(av.type.code, d);
    }
  }

  const breadcrumb: { name: string; slug: string; path: string[] }[] = [];
  let cat = byId.get(p.categoryId);
  while (cat) {
    breadcrumb.unshift({ name: cat.name, slug: cat.slug, path: cat.path });
    cat = cat.parentId ? byId.get(cat.parentId) : undefined;
  }

  const related = products.filter((r) => r.categoryId === p.categoryId && r.id !== p.id);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    family: p.family,
    material: p.material,
    care: p.care,
    details: (p.details ?? {}) as Record<string, string>,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
    breadcrumb,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt, color: i.colorValue?.value ?? null })),
    options: [...dims.values()]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({
        code: d.code,
        name: d.name,
        values: [...d.values.values()].sort((a, b) => a.position - b.position || a.value.localeCompare(b.value, "fr", { numeric: true })),
      })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      ...effectivePrice(v, p.categoryId, sales),
      options: Object.fromEntries(v.attributeValues.map((av) => [av.type.code, av.value])),
    })),
    reviews,
    related: related.slice(0, 8).map((r) => toCard(r, sales)),
  };
}

/** Stock en temps réel (non mis en cache), lu côté client sur la fiche produit. */
export async function getStock(productId: string) {
  const rows = await repo.findVariantStock(productId);
  return rows.map((r) => {
    const available = Math.max(0, r.stock - r.stockReserved);
    return { variantId: r.id, available, low: available > 0 && available <= r.lowStockAlert };
  });
}

export async function getCollection(slug: string) {
  const c = await prisma.collection.findUnique({ where: { slug } });
  if (!c) throw AppError.notFound("Collection introuvable");
  return { id: c.id, name: c.name, slug: c.slug, type: c.type };
}
