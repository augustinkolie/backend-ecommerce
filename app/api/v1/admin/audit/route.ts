import { auditQuery, listAudit } from "@/src/modules/admin/team";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "team");
  return ok(await listAudit(parseQuery(req, auditQuery)));
});
