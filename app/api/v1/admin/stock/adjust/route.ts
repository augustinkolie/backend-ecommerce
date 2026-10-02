import { adjustBody, adjustStock } from "@/src/modules/admin/stock";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const POST = handle(async (req) => {
  const user = await requirePermission(req, "stock");
  return ok(await adjustStock(await parseBody(req, adjustBody), user));
});
