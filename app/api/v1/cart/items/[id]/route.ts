import { z } from "zod";
import { handle, ok, parseBody } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { removeItem, updateItem } from "@/src/modules/cart/service";

const body = z.object({ quantity: z.number().int().min(0).max(20) });

export const PATCH = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const { quantity } = await parseBody(req, body);
  const { view, headers } = await updateItem(req, id, quantity);
  return ok(view, { headers });
});

export const DELETE = handle(async (req, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const { view, headers } = await removeItem(req, id);
  return ok(view, { headers });
});
