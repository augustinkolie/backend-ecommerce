import { listSales, saleBody, saveSale } from "@/src/modules/admin/promotions";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "promotions");
  return ok(await listSales());
});
export const POST = handle(async (req) => {
  const user = await requirePermission(req, "promotions");
  return ok(await saveSale(await parseBody(req, saleBody), user), { status: 201 });
});
