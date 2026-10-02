import { requireUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { handle, ok } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { customerOrder } from "@/src/modules/orders/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, ctx: Ctx<{ number: string }>) => {
  const user = await requireUser(req);
  const n = Number((await ctx.params).number);
  if (!Number.isInteger(n)) throw AppError.notFound();
  return ok(await customerOrder(user.id, n));
});
