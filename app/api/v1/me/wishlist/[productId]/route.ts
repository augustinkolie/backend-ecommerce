import { requireUser } from "@/src/lib/auth";
import { handle, ok } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { removeFromWishlist } from "@/src/modules/account/service";

export const DELETE = handle(async (req, ctx: Ctx<{ productId: string }>) => {
  const user = await requireUser(req);
  const { productId } = await ctx.params;
  await removeFromWishlist(user.id, productId);
  return ok({ productId });
});
