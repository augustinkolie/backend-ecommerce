import { handle, ok, parseBody } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { registerBody } from "@/src/modules/auth/schema";
import { register } from "@/src/modules/auth/service";

export const POST = handle(async (req) => {
  await rateLimit(req, "register", 10, 3600);
  const { headers, user } = await register(req, await parseBody(req, registerBody));
  return ok(user, { status: 201, headers });
});
