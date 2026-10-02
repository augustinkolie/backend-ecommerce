import { handle, ok } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { getStock } from "@/src/modules/catalog/service";

export const dynamic = "force-dynamic";

/** Le segment est l'identifiant produit (le stock n'est jamais mis en cache). */
export const GET = handle(async (_req, ctx: Ctx<{ slug: string }>) => {
  const { slug: productId } = await ctx.params;
  return ok(await getStock(productId), { headers: { "cache-control": "no-store" } });
});
