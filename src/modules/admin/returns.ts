import { z } from "zod";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";

export const returnListQuery = z.object({ status: z.enum(["REQUESTED", "ACCEPTED", "REFUSED", "RECEIVED", "REFUNDED"]).optional() });
export const returnPatch = z.object({ status: z.enum(["REQUESTED", "ACCEPTED", "REFUSED", "RECEIVED", "REFUNDED"]) });

export const listReturns = (q: z.infer<typeof returnListQuery>) =>
  prisma.returnRequest.findMany({
    where: q.status ? { status: q.status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { order: { select: { id: true, number: true, items: true } }, user: { select: { name: true, email: true } } },
  });

export async function updateReturn(id: string, input: z.infer<typeof returnPatch>, author: AuthUser) {
  const before = await prisma.returnRequest.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("Retour introuvable");
  const r = await prisma.$transaction(async (tx) => {
    const updated = await tx.returnRequest.update({ where: { id }, data: { status: input.status } });
    await tx.orderEvent.create({ data: { orderId: before.orderId, type: "return", message: `Retour : ${input.status}`, authorId: author.id, internal: false } });
    // Articles reçus : remis en stock.
    if (input.status === "RECEIVED" && before.status !== "RECEIVED") {
      const items = before.items as { orderItemId: string; quantity: number }[];
      for (const i of items) {
        const line = await tx.orderItem.findUnique({ where: { id: i.orderItemId } });
        if (!line?.variantId) continue;
        await tx.productVariant.update({ where: { id: line.variantId }, data: { stock: { increment: i.quantity } } });
        await tx.stockMovement.create({ data: { variantId: line.variantId, type: "RETURN", quantity: i.quantity, reason: "Retour client", authorId: author.id } });
      }
    }
    await audit(author, "return.update", "ReturnRequest", id, { status: before.status }, { status: updated.status }, tx);
    return updated;
  });
  return r;
}
