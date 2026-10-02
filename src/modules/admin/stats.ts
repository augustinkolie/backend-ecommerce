import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

export const statsQuery = z.object({ range: z.enum(["1d", "7d", "30d", "90d"]).default("30d") });

const PAID = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;
const DAY = 86400_000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function revenueSince(from: Date) {
  const agg = await prisma.order.aggregate({ where: { status: { in: [...PAID] }, createdAt: { gte: from } }, _sum: { total: true }, _count: true });
  return { revenue: agg._sum.total ?? 0, orders: agg._count };
}

/** Tableau de bord : CA jour / 7 j / 30 j, commandes à traiter, panier moyen, conversion, top 10, alertes stock, série des ventes. */
export async function dashboard(range: z.infer<typeof statsQuery>["range"]) {
  const now = new Date();
  const days = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 }[range];
  const from = startOfDay(new Date(now.getTime() - (days - 1) * DAY));

  const [today, week, month, current, toProcess, cartsInRange, topItems, variants, recentOrders] = await Promise.all([
    revenueSince(startOfDay(now)),
    revenueSince(startOfDay(new Date(now.getTime() - 6 * DAY))),
    revenueSince(startOfDay(new Date(now.getTime() - 29 * DAY))),
    prisma.order.findMany({ where: { status: { in: [...PAID] }, createdAt: { gte: from } }, select: { total: true, createdAt: true } }),
    prisma.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
    prisma.cart.count({ where: { createdAt: { gte: from } } }),
    prisma.orderItem.groupBy({
      by: ["variantId"],
      where: { order: { status: { in: [...PAID] }, createdAt: { gte: from } }, variantId: { not: null } },
      _sum: { quantity: true },
    }),
    prisma.productVariant.findMany({
      where: { deletedAt: null, product: { deletedAt: null } },
      select: { id: true, sku: true, stock: true, stockReserved: true, lowStockAlert: true, productId: true, product: { select: { name: true } }, attributeValues: { select: { value: true } } },
    }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, status: true, total: true, currency: true, email: true, createdAt: true } }),
  ]);

  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + i * DAY);
    return { date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 };
  });
  for (const o of current) {
    const idx = Math.floor((startOfDay(o.createdAt).getTime() - from.getTime()) / DAY);
    if (series[idx]) {
      series[idx].revenue += o.total;
      series[idx].orders++;
    }
  }

  const rangeRevenue = current.reduce((n, o) => n + o.total, 0);
  const byVariant = new Map(variants.map((v) => [v.id, v]));
  const byProduct = new Map<string, { productId: string; name: string; quantity: number }>();
  for (const t of topItems) {
    const v = byVariant.get(t.variantId!);
    if (!v) continue;
    const cur = byProduct.get(v.productId) ?? { productId: v.productId, name: v.product.name, quantity: 0 };
    cur.quantity += t._sum.quantity ?? 0;
    byProduct.set(v.productId, cur);
  }

  return {
    range,
    revenue: { today: today.revenue, week: week.revenue, month: month.revenue, range: rangeRevenue },
    ordersInRange: current.length,
    toProcess,
    averageOrder: current.length ? Math.round(rangeRevenue / current.length) : 0,
    /** Taux de conversion approché : commandes payées / paniers créés sur la période. */
    conversionRate: cartsInRange ? Math.round((current.length / cartsInRange) * 1000) / 10 : 0,
    topProducts: [...byProduct.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    lowStock: variants
      .filter((v) => v.stock - v.stockReserved <= v.lowStockAlert)
      .sort((a, b) => a.stock - a.stockReserved - (b.stock - b.stockReserved))
      .slice(0, 12)
      .map((v) => ({ variantId: v.id, sku: v.sku, productId: v.productId, name: v.product.name, variant: v.attributeValues.map((a) => a.value).join(" · "), available: v.stock - v.stockReserved })),
    series,
    recentOrders,
  };
}

/** Palette Ctrl/Cmd + K : commandes, produits, clients. */
export async function paletteSearch(q: string) {
  const term = q.trim();
  if (!term) return { orders: [], products: [], customers: [] };
  const n = Number(term.replace(/^#/, ""));
  const [orders, products, customers] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [...(Number.isInteger(n) ? [{ number: n }] : []), { email: { contains: term, mode: "insensitive" } }] },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, email: true, status: true },
    }),
    prisma.product.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: term, mode: "insensitive" } }, { variants: { some: { sku: { contains: term, mode: "insensitive" } } } }] },
      take: 5,
      select: { id: true, name: true, status: true },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", OR: [{ email: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }] },
      take: 5,
      select: { id: true, name: true, email: true },
    }),
  ]);
  return { orders, products, customers };
}
