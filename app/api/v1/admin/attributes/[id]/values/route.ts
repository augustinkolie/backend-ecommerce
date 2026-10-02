import { attributeValueBody, saveAttributeValue } from "@/src/modules/admin/catalog";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const POST = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "products");
  return ok(await saveAttributeValue((await ctx.params).id, await parseBody(req, attributeValueBody), user), { status: 201 });
});
