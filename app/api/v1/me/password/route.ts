import { requireUser } from "@/src/lib/auth";
import { handle, ok, parseBody } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { changePassword, passwordBody } from "@/src/modules/account/service";

export const POST = handle(async (req) => {
  await rateLimit(req, "password", 10, 900);
  const user = await requireUser(req);
  await changePassword(user.id, await parseBody(req, passwordBody));
  return ok({ updated: true });
});
