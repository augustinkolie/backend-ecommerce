import { handle, ok } from "@/src/lib/http";
import { logout } from "@/src/modules/auth/service";

export const POST = handle(async (req) => ok({ loggedOut: true }, { headers: await logout(req) }));
