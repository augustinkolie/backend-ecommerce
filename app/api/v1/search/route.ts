import { z } from "zod";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { search } from "@/src/modules/search/service";

const query = z.object({ q: z.string().max(100).default(""), limit: z.coerce.number().int().min(1).max(48).default(12), page: z.coerce.number().int().min(1).max(1000).default(1) });

export const GET = handle(async (req) => {
  await rateLimit(req, "search", 120, 60);
  const { q, limit, page } = parseQuery(req, query);
  return ok(await search(q, limit, page));
});
