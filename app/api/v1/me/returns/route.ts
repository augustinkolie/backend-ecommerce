import { requireUser } from "@/src/lib/auth";
import { handle, ok, parseBody } from "@/src/lib/http";
import { listReturns, requestReturn, returnBody } from "@/src/modules/account/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => ok(await listReturns((await requireUser(req)).id)));

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  return ok(await requestReturn(user.id, await parseBody(req, returnBody)), { status: 201 });
});
