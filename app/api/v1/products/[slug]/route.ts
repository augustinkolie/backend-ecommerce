import { handle, ok } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { getProduct } from "@/src/modules/catalog/service";

export const GET = handle(async (_req, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  return ok(await getProduct(slug));
});
