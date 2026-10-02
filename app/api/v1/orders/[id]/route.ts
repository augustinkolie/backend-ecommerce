import { handle, ok } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { publicOrder } from "@/src/modules/orders/service";

export const dynamic = "force-dynamic";

/** Récapitulatif minimal (page de confirmation), accessible par l'identifiant opaque de la commande. */
export const GET = handle(async (_req, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  return ok(await publicOrder(id));
});
