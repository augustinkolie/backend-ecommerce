import { requireUser } from "@/src/lib/auth";
import { handle, ok, parseBody } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { addressBody, deleteAddress, saveAddress } from "@/src/modules/account/service";

export const PATCH = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  return ok(await saveAddress(user.id, await parseBody(req, addressBody), id));
});

export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  await deleteAddress(user.id, (await ctx.params).id);
  return ok({ deleted: true });
});
