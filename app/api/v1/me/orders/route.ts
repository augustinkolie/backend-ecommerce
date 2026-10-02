import { requireUser } from "@/src/lib/auth";
import { handle, ok } from "@/src/lib/http";
import { customerOrders } from "@/src/modules/orders/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => ok(await customerOrders((await requireUser(req)).id)));
