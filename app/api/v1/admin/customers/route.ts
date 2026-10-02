import { customerListQuery, listCustomers } from "@/src/modules/admin/customers";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "customers");
  return ok(await listCustomers(parseQuery(req, customerListQuery)));
});
