import { z } from "zod";
import { paletteSearch } from "@/src/modules/admin/stats";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { requireStaff } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requireStaff(req);
  const { q } = parseQuery(req, z.object({ q: z.string().max(100).default("") }));
  return ok(await paletteSearch(q));
});
