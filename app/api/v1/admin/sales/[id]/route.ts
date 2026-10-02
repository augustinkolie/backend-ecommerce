import { deleteSale, saleBody, saveSale } from "@/src/modules/admin/promotions";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PUT = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "promotions");
  return ok(await saveSale(await parseBody(req, saleBody), user, (await ctx.params).id));
});
export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "promotions");
  await deleteSale((await ctx.params).id, user);
  return ok({ deleted: true });
});
