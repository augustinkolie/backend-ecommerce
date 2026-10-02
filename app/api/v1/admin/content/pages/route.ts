import { listPages } from "@/src/modules/admin/content";
import { handle, ok } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "content");
  return ok(await listPages());
});
