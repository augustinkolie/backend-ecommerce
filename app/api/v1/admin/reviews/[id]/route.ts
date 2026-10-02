import { moderate, moderateBody } from "@/src/modules/admin/reviews";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PATCH = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "reviews");
  return ok(await moderate((await ctx.params).id, await parseBody(req, moderateBody), user));
});
