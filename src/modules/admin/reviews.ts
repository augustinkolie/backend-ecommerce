import { z } from "zod";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prismaPage, toPage } from "@/src/lib/pagination";
import { prisma } from "@/src/lib/prisma";
import { revalidateFrontend } from "@/src/lib/revalidate";

export const reviewListQuery = z.object({
  status: z.enum(["PENDING", "APPROVED", "HIDDEN"]).optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const moderateBody = z.object({
  status: z.enum(["PENDING", "APPROVED", "HIDDEN"]).optional(),
  reply: z.string().trim().max(2000).nullable().optional(),
});

export async function listReviews(q: z.infer<typeof reviewListQuery>) {
  const where = q.status ? { status: q.status } : {};
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...prismaPage(q, q.limit),
      include: { user: { select: { name: true, email: true } }, product: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  return toPage(rows, q.limit, total, q.page);
}

export async function moderate(id: string, input: z.infer<typeof moderateBody>, author: AuthUser) {
  const before = await prisma.review.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("Avis introuvable");
  const r = await prisma.review.update({ where: { id }, data: { status: input.status, reply: input.reply === undefined ? undefined : input.reply } });
  await audit(author, "review.moderate", "Review", id, { status: before.status, reply: before.reply }, { status: r.status, reply: r.reply });
  await revalidateFrontend([`product:${r.productId}`]);
  return r;
}
