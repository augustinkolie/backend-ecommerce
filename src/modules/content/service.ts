import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { getSettings } from "@/src/lib/settings";
import { catalogSnapshot } from "../catalog/service";
import { listZones } from "../shipping/service";

/** Point produit de la une : produit publié et position (x, y en % de la photo). */
export type HeroHotspot = { productId: string; x: number; y: number };

export function readHotspots(value: unknown): HeroHotspot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((h): h is HeroHotspot => !!h && typeof h.productId === "string" && typeof h.x === "number" && typeof h.y === "number");
}

/** Accueil : une (photo + produits cliquables), collections, nouveautés, meilleures ventes, réassurance. */
export async function homeContent() {
  const [blocks, { products, cards: cardById }, collections, settings] = await Promise.all([
    prisma.contentBlock.findMany({ where: { active: true }, orderBy: [{ slot: "asc" }, { position: "asc" }] }),
    catalogSnapshot(),
    prisma.collection.findMany({ orderBy: { name: "asc" }, take: 6 }),
    getSettings(),
  ]);
  const cards = products.map((p) => ({ p, card: cardById.get(p.id)! }));
  const hero = blocks.filter((b) => b.slot === "home_hero");
  // Produits de la une : données à jour (prix soldé, image), produits dépubliés ignorés.
  const byId = new Map(cards.map((c) => [c.card.id, c.card]));
  const heroProducts = readHotspots(hero[0]?.hotspots).flatMap(({ productId, x, y }) => {
    const c = byId.get(productId);
    return c ? [{ id: c.id, slug: c.slug, name: c.name, price: c.price, compareAtPrice: c.compareAtPrice, imageUrl: c.imageUrl, imageAlt: c.imageAlt, x, y }] : [];
  });
  const sold = (p: (typeof products)[number]) => p.variants.reduce((n, v) => n + v._count.orderItems, 0);
  return {
    hero,
    heroProducts,
    featured: blocks.filter((b) => b.slot === "home_collection"),
    collections: collections.map((c) => ({ name: c.name, slug: c.slug })),
    newArrivals: [...cards]
      .sort((a, b) => (b.p.publishedAt ?? b.p.createdAt).getTime() - (a.p.publishedAt ?? a.p.createdAt).getTime())
      .slice(0, 8)
      .map((x) => x.card),
    bestSellers: [...cards].sort((a, b) => sold(b.p) - sold(a.p)).slice(0, 8).map((x) => x.card),
    freeShippingThreshold: settings.freeShippingThreshold,
  };
}

export async function getPage(slug: string) {
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) throw AppError.notFound("Page introuvable");
  return page;
}

export async function publicSettings() {
  const s = await getSettings();
  return {
    shopName: s.shopName,
    currency: s.currency,
    locale: s.locale,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    freeShippingThreshold: s.freeShippingThreshold,
    paymentMethods: s.paymentMethods.filter((m) => m.enabled).map(({ code, label }) => ({ code, label })),
    shippingZones: (await listZones()).map((z) => ({
      id: z.id, name: z.name, cities: z.cities, price: z.price, freeAbove: z.freeAbove, isPickup: z.isPickup, delay: z.delay,
    })),
  };
}
