import { listOrders, orderListQuery } from "@/src/modules/admin/orders";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "orders");
  return ok(await listOrders(parseQuery(req, orderListQuery)));
});
