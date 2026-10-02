import { listZonesAdmin, saveZone, zoneBody } from "@/src/modules/admin/content";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "settings");
  return ok(await listZonesAdmin());
});
export const POST = handle(async (req) => {
  const user = await requirePermission(req, "settings");
  return ok(await saveZone(await parseBody(req, zoneBody), user), { status: 201 });
});
