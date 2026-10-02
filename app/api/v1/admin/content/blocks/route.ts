import { blockBody, listBlocks, saveBlock } from "@/src/modules/admin/content";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "content");
  return ok(await listBlocks());
});
export const POST = handle(async (req) => {
  const user = await requirePermission(req, "content");
  return ok(await saveBlock(await parseBody(req, blockBody), user), { status: 201 });
});
