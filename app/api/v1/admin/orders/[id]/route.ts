import { getOrder } from "@/src/modules/admin/orders";
import { handle, ok } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const dynamic = "force-dynamic";
export const GET = handle(async (req, ctx: Ctx<{ id: string }>) => {
  await requirePermission(req, "orders");
  return ok(await getOrder((await ctx.params).id));
});
