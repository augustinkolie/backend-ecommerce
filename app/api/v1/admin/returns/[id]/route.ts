import { returnPatch, updateReturn } from "@/src/modules/admin/returns";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PATCH = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "orders.status");
  return ok(await updateReturn((await ctx.params).id, await parseBody(req, returnPatch), user));
});
