import { pageBody, savePage } from "@/src/modules/admin/content";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const PUT = handle(async (req, ctx: Ctx<{ slug: string }>) => {
  const user = await requirePermission(req, "content");
  return ok(await savePage((await ctx.params).slug, await parseBody(req, pageBody), user));
});
