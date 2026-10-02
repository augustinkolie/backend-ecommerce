import { requireUser } from "@/src/lib/auth";
import { handle, ok, parseBody } from "@/src/lib/http";
import { addressBody, listAddresses, saveAddress } from "@/src/modules/account/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => ok(await listAddresses((await requireUser(req)).id)));

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  return ok(await saveAddress(user.id, await parseBody(req, addressBody)), { status: 201 });
});
