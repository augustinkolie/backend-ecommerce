import { handle, ok } from "@/src/lib/http";
import { homeContent } from "@/src/modules/content/service";

export const GET = handle(async () => ok(await homeContent()));
