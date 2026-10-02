import { handle, ok } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { refresh } from "@/src/modules/auth/service";

export const POST = handle(async (req) => {
  await rateLimit(req, "refresh", 60, 60);
  const { headers, user } = await refresh(req);
  return ok(user, { headers });
});
