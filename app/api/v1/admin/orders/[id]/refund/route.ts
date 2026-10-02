import { refundBody } from "@/src/modules/orders/schema";
import { refundOrder } from "@/src/modules/orders/service";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const POST = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "orders.refund");
  return ok(await refundOrder((await ctx.params).id, await parseBody(req, refundBody), user));
});
