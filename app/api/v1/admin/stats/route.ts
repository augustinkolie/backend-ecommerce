import { dashboard, statsQuery } from "@/src/modules/admin/stats";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "dashboard");
  return ok(await dashboard(parseQuery(req, statsQuery).range));
});
