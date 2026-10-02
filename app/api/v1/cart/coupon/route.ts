import { z } from "zod";
import { handle, ok, parseBody } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { applyCoupon, removeCoupon } from "@/src/modules/cart/service";

const body = z.object({ code: z.string().trim().min(1, "Code requis").max(40) });

export const POST = handle(async (req) => {
  await rateLimit(req, "coupon", 20, 600);
  const { code } = await parseBody(req, body);
  const { view, headers } = await applyCoupon(req, code);
  return ok(view, { headers });
});

export const DELETE = handle(async (req) => {
  const { view, headers } = await removeCoupon(req);
  return ok(view, { headers });
});
