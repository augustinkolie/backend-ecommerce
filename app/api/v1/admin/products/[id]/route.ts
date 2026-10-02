import { bulkProducts, getProduct, productBody, saveProduct } from "@/src/modules/admin/products";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const dynamic = "force-dynamic";
export const GET = handle(async (req, ctx: Ctx<{ id: string }>) => {
  await requirePermission(req, "products");
  return ok(await getProduct((await ctx.params).id));
});
export const PUT = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  return ok(await saveProduct(await parseBody(req, productBody), user, (await ctx.params).id));
});
export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  return ok(await bulkProducts({ ids: [(await ctx.params).id], action: "delete" }, user));
});
