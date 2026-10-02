import { blockBody, deleteBlock, saveBlock } from "@/src/modules/admin/content";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PUT = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "content");
  return ok(await saveBlock(await parseBody(req, blockBody), user, (await ctx.params).id));
});
export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "content");
  await deleteBlock((await ctx.params).id, user);
  return ok({ deleted: true });
});
