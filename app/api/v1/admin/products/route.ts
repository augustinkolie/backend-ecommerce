import { listProducts, productBody, productListQuery, saveProduct } from "@/src/modules/admin/products";
import { handle, ok, parseBody, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "products");
  return ok(await listProducts(parseQuery(req, productListQuery)));
});
export const POST = handle(async (req) => {
  const user = await requirePermission(req, "products");
  return ok(await saveProduct(await parseBody(req, productBody), user), { status: 201 });
});
