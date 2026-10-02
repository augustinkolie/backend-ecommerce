import { bulkBody, bulkProducts } from "@/src/modules/admin/products";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const POST = handle(async (req) => {
  const user = await requirePermission(req, "products");
  return ok(await bulkProducts(await parseBody(req, bulkBody), user));
});
