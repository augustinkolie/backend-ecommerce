import { z } from "zod";
import { handle, ok, parseBody } from "@/src/lib/http";
import { addItem } from "@/src/modules/cart/service";

const body = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20).default(1) });

export const POST = handle(async (req) => {
  const { variantId, quantity } = await parseBody(req, body);
  const { view, headers } = await addItem(req, variantId, quantity);
  return ok(view, { status: 201, headers });
});
