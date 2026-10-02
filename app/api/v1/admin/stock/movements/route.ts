import { listMovements, movementQuery } from "@/src/modules/admin/stock";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "stock");
  return ok(await listMovements(parseQuery(req, movementQuery)));
});
