import { customerPatch, getCustomer, updateCustomer } from "@/src/modules/admin/customers";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const dynamic = "force-dynamic";
export const GET = handle(async (req, ctx: Ctx<{ id: string }>) => {
  await requirePermission(req, "customers");
  return ok(await getCustomer((await ctx.params).id));
});
export const PATCH = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "customers");
  return ok(await updateCustomer((await ctx.params).id, await parseBody(req, customerPatch), user));
});
