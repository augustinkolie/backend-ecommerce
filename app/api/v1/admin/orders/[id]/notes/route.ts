import { noteBody } from "@/src/modules/orders/schema";
import { addNote } from "@/src/modules/orders/service";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const POST = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requirePermission(req, "orders");
  await addNote((await ctx.params).id, (await parseBody(req, noteBody)).message, user);
  return ok({ added: true }, { status: 201 });
});
