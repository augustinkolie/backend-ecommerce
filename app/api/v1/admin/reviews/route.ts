import { listReviews, reviewListQuery } from "@/src/modules/admin/reviews";
import { handle, ok, parseQuery } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "reviews");
  return ok(await listReviews(parseQuery(req, reviewListQuery)));
});
