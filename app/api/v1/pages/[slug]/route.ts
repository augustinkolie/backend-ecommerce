import { handle, ok } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { getPage } from "@/src/modules/content/service";

export const GET = handle(async (_req, ctx: Ctx<{ slug: string }>) => ok(await getPage((await ctx.params).slug)));
