import { z } from "zod";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";

export const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10, "10 caractères minimum").max(2000),
});

export async function listReviews(productId: string) {
  const rows = await prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    reply: r.reply,
    createdAt: r.createdAt,
    author: r.user.name ? `${r.user.name.split(" ")[0]} ${r.user.name.split(" ")[1]?.[0] ?? ""}.`.trim() : "Client",
    verified: true,
  }));
}

/** Avis vérifié : achat obligatoire (commande payée, expédiée ou livrée contenant le produit). */
export async function createReview(userId: string, productId: string, input: z.infer<typeof reviewBody>) {
  const purchased = await prisma.orderItem.findFirst({
    where: {
      variant: { productId },
      order: { userId, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } },
    },
  });
  if (!purchased) throw AppError.forbidden("Seuls les clients ayant acheté ce produit peuvent laisser un avis.");
  const existing = await prisma.review.findUnique({ where: { userId_productId: { userId, productId } } });
  if (existing) throw AppError.conflict("Vous avez déjà donné votre avis sur ce produit.");
  return prisma.review.create({ data: { userId, productId, ...input } });
}
