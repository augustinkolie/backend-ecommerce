import { exportOrdersCsv, orderListQuery } from "@/src/modules/admin/orders";
import { handle, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "orders");
  return new Response(await exportOrdersCsv(parseQuery(req, orderListQuery)), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="commandes.csv"' },
  });
});
