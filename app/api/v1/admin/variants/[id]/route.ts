import { z } from "zod";
import { audit } from "@/src/lib/audit";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { afterCatalogChange } from "@/src/modules/admin/products";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

const body = z.object({
  price: z.number().int().min(0).optional(),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).optional(),
  lowStockAlert: z.number().int().min(0).optional(),
});

/** Édition en ligne d'une variante (prix, stock) depuis la matrice. */
export const PATCH = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  const { id } = await ctx.params;
  const input = await parseBody(req, body);
  const before = await prisma.productVariant.findUnique({ where: { id } });
  if (!before) throw AppError.notFound("Variante introuvable");
  if (input.stock !== undefined && input.stock < before.stockReserved) throw AppError.badRequest("Stock inférieur aux réservations");
  const v = await prisma.$transaction(async (tx) => {
    const u = await tx.productVariant.update({ where: { id }, data: input });
    if (input.stock !== undefined && input.stock !== before.stock) {
      await tx.stockMovement.create({ data: { variantId: id, type: "ADJUSTMENT", quantity: input.stock - before.stock, reason: "Édition en ligne", authorId: user.id } });
    }
    await audit(user, "variant.update", "ProductVariant", id, before, u, tx);
    return u;
  });
  await afterCatalogChange([v.productId]);
  return ok(v);
});
