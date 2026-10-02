import { getAuth } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { handle, ok, parseBody } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { checkoutBody } from "@/src/modules/orders/schema";
import { checkout } from "@/src/modules/orders/service";

/** Crée la commande, réserve le stock 15 min et lance le paiement. Idempotent (Idempotency-Key). */
export const POST = handle(async (req) => {
  await rateLimit(req, "checkout", 20, 600);
  const key = req.headers.get("idempotency-key");
  if (!key || key.length < 8 || key.length > 100) throw AppError.badRequest("En-tête Idempotency-Key requis");
  const input = await parseBody(req, checkoutBody);
  const { order, redirectUrl, replay } = await checkout(req, input, key, await getAuth(req));
  return ok(
    { orderId: order.id, number: order.number, status: order.status, total: order.total, redirectUrl },
    { status: replay ? 200 : 201 },
  );
});
