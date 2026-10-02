import { handle, ok, parseBody } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { loginBody } from "@/src/modules/auth/schema";
import { login } from "@/src/modules/auth/service";

export const POST = handle(async (req) => {
  await rateLimit(req, "login", 10, 900);
  const { headers, user } = await login(req, await parseBody(req, loginBody));
  return ok(user, { headers });
});
