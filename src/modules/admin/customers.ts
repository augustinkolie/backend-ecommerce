import { z } from "zod";
import type { Prisma } from "@/src/generated/prisma/client";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prismaPage, toPage } from "@/src/lib/pagination";
import { prisma } from "@/src/lib/prisma";

export const customerListQuery = z.object({
  q: z.string().optional(),
  blocked: z.enum(["1"]).optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const customerPatch = z.object({
  notes: z.string().max(5000).nullable().optional(),
  blocked: z.boolean().optional(),
});

const PAID = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

export async function listCustomers(q: z.infer<typeof customerListQuery>) {
  const where: Prisma.UserWhereInput = { role: "CUSTOMER", deletedAt: null };
  if (q.q) where.OR = [{ email: { contains: q.q, mode: "insensitive" } }, { name: { contains: q.q, mode: "insensitive" } }, { phone: { contains: q.q } }];
  if (q.blocked) where.blockedAt = { not: null };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...prismaPage(q, q.limit) }),
    prisma.user.count({ where }),
  ]);
  const stats = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: rows.map((r) => r.id) }, status: { in: [...PAID] } },
    _sum: { total: true },
    _count: true,
  });
  const byUser = new Map(stats.map((s) => [s.userId, s]));
  return toPage(
    rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      blocked: !!u.blockedAt,
      createdAt: u.createdAt,
      orderCount: byUser.get(u.id)?._count ?? 0,
      totalSpent: byUser.get(u.id)?._sum.total ?? 0,
    })),
    q.limit,
    total,
    q.page,
  );
}

export async function getCustomer(id: string) {
  const u = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      addresses: true,
      orders: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, number: true, status: true, total: true, currency: true, createdAt: true } },
      reviews: { orderBy: { createdAt: "desc" }, take: 20, include: { product: { select: { name: true } } } },
    },
  });
  if (!u) throw AppError.notFound("Client introuvable");
  const agg = await prisma.order.aggregate({ where: { userId: id, status: { in: [...PAID] } }, _sum: { total: true }, _count: true });
  const { passwordHash: _omit, ...rest } = u;
  void _omit;
  return { ...rest, totalSpent: agg._sum.total ?? 0, paidOrders: agg._count };
}

export async function updateCustomer(id: string, input: z.infer<typeof customerPatch>, author: AuthUser) {
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before || before.role !== "CUSTOMER") throw AppError.notFound("Client introuvable");
  const u = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        notes: input.notes === undefined ? undefined : input.notes,
        blockedAt: input.blocked === undefined ? undefined : input.blocked ? new Date() : null,
      },
    });
    if (input.blocked) await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(author, input.blocked !== undefined ? (input.blocked ? "customer.block" : "customer.unblock") : "customer.update", "User", id,
      { notes: before.notes, blocked: !!before.blockedAt }, { notes: updated.notes, blocked: !!updated.blockedAt }, tx);
    return updated;
  });
  return { id: u.id, notes: u.notes, blocked: !!u.blockedAt };
}
