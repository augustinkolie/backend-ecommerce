import { handle, ok } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { provider } from "@/src/modules/payments/providers";
import { handlePaymentEvent } from "@/src/modules/orders/service";

/** Confirmation de paiement : signature vérifiée, traitement idempotent, stock décrémenté en transaction. */
export const POST = handle(async (req, ctx: Ctx<{ provider: string }>) => {
  const { provider: code } = await ctx.params;
  const raw = await req.text();
  const evt = await provider(code).verifyWebhook(req, raw);
  return ok(await handlePaymentEvent(code, evt));
});
