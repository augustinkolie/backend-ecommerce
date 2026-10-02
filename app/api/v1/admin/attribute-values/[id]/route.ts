import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { attributeValueBody, deleteAttributeValue, saveAttributeValue } from "@/src/modules/admin/catalog";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PUT = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  const { id } = await ctx.params;
  const v = await prisma.attributeValue.findUnique({ where: { id } });
  if (!v) throw AppError.notFound("Valeur introuvable");
  return ok(await saveAttributeValue(v.typeId, await parseBody(req, attributeValueBody), user, id));
});
export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  await deleteAttributeValue((await ctx.params).id, user);
  return ok({ deleted: true });
});
