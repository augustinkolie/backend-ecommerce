import { collectionBody, deleteCollection, getCollection, saveCollection } from "@/src/modules/admin/catalog";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const dynamic = "force-dynamic";
export const GET = handle(async (req, ctx: Ctx<{ id: string }>) => {
  await requirePermission(req, "products");
  return ok(await getCollection((await ctx.params).id));
});
export const PUT = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  return ok(await saveCollection(await parseBody(req, collectionBody), user, (await ctx.params).id));
});
export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  await deleteCollection((await ctx.params).id, user);
  return ok({ deleted: true });
});
