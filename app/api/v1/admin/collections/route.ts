import { collectionBody, listCollections, saveCollection } from "@/src/modules/admin/catalog";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "products");
  return ok(await listCollections());
});
export const POST = handle(async (req) => {
  const user = await requirePermission(req, "products");
  return ok(await saveCollection(await parseBody(req, collectionBody), user), { status: 201 });
});
