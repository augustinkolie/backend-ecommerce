import { z } from "zod";
import { requireUser } from "@/src/lib/auth";
import { handle, ok, parseBody } from "@/src/lib/http";
import { addToWishlist, wishlist } from "@/src/modules/account/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => ok(await wishlist((await requireUser(req)).id)));

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const { productId } = await parseBody(req, z.object({ productId: z.string().min(1) }));
  await addToWishlist(user.id, productId);
  return ok({ productId }, { status: 201 });
});
