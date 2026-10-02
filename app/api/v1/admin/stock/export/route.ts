import { exportStockCsv } from "@/src/modules/admin/stock";
import { handle } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "stock");
  return new Response(await exportStockCsv(), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="stock.csv"' },
  });
});
