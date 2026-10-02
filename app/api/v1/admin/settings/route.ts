import { getSettings } from "@/src/lib/settings";
import { settingsBody, updateSettings } from "@/src/modules/admin/content";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "settings");
  return ok(await getSettings());
});
export const PUT = handle(async (req) => {
  const user = await requirePermission(req, "settings");
  return ok(await updateSettings(await parseBody(req, settingsBody), user));
});
