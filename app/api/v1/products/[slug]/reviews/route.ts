import { requireUser } from "@/src/lib/auth";
import { handle, ok, parseBody } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { rateLimit } from "@/src/lib/rate-limit";
import { createReview, listReviews, reviewBody } from "@/src/modules/reviews/service";

/** Le segment est l'identifiant produit. */
export const GET = handle(async (_req, ctx: Ctx<{ slug: string }>) => ok(await listReviews((await ctx.params).slug)));

export const POST = handle(async (req, ctx: Ctx<{ slug: string }>) => {
  await rateLimit(req, "review", 10, 3600);
  const user = await requireUser(req);
  const review = await createReview(user.id, (await ctx.params).slug, await parseBody(req, reviewBody));
  return ok({ id: review.id, status: review.status }, { status: 201 });
});
