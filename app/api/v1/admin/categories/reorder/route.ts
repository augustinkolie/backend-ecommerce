import { reorderBody, reorderCategories } from "@/src/modules/admin/catalog";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const POST = handle(async (req) => {
  const user = await requirePermission(req, "products");
  await reorderCategories(await parseBody(req, reorderBody), user);
  return ok({ reordered: true });
});
