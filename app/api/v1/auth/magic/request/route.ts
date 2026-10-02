import { handle, ok, parseBody } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/rate-limit";
import { magicRequestBody } from "@/src/modules/auth/schema";
import { requestMagicLink } from "@/src/modules/auth/service";

/** Réponse identique que le compte existe ou non (pas d'énumération des e-mails). */
export const POST = handle(async (req) => {
  await rateLimit(req, "magic", 5, 900);
  const { email } = await parseBody(req, magicRequestBody);
  await requestMagicLink(email);
  return ok({ sent: true });
});
