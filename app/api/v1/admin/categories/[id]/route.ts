import { categoryBody, deleteCategory, saveCategory } from "@/src/modules/admin/catalog";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PUT = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  return ok(await saveCategory(await parseBody(req, categoryBody), user, (await ctx.params).id));
});
export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  await deleteCategory((await ctx.params).id, user);
  return ok({ deleted: true });
});
