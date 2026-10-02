import { z } from "zod";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { getCartView } from "@/src/modules/cart/service";

export const dynamic = "force-dynamic";

const query = z.object({ city: z.string().max(80).optional() });

export const GET = handle(async (req) => {
  const { city } = parseQuery(req, query);
  const { view, headers } = await getCartView(req, city);
  return ok(view, { headers });
});
