import { requireUser } from "@/src/lib/auth";
import { handle, ok, parseBody } from "@/src/lib/http";
import { me, profileBody, updateProfile } from "@/src/modules/account/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => ok(await me((await requireUser(req)).id)));

export const PATCH = handle(async (req) => {
  const user = await requireUser(req);
  return ok(await updateProfile(user.id, await parseBody(req, profileBody)));
});
