import { staffPatch, updateStaff } from "@/src/modules/admin/team";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PATCH = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "team");
  return ok(await updateStaff((await ctx.params).id, await parseBody(req, staffPatch), user));
});
