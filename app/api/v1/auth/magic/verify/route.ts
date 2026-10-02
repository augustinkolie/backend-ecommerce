import { handle, ok, parseBody } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { magicVerifyBody } from "@/src/modules/auth/schema";
import { verifyMagicLink } from "@/src/modules/auth/service";

export const POST = handle(async (req) => {
  await rateLimit(req, "magic-verify", 20, 900);
  const { token } = await parseBody(req, magicVerifyBody);
  const { headers, user } = await verifyMagicLink(req, token);
  return ok(user, { headers });
});
