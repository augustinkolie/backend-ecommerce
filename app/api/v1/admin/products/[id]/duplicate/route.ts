import { duplicateProduct } from "@/src/modules/admin/products";
import { handle, ok } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const POST = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  return ok(await duplicateProduct((await ctx.params).id, user), { status: 201 });
});
