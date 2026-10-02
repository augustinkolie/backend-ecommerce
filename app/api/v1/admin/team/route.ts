import { createStaff, listStaff, staffBody } from "@/src/modules/admin/team";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "team");
  return ok(await listStaff());
});
export const POST = handle(async (req) => {
  const user = await requirePermission(req, "team");
  return ok(await createStaff(await parseBody(req, staffBody), user), { status: 201 });
});
