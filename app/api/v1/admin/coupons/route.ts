import { couponBody, listCoupons, saveCoupon } from "@/src/modules/admin/promotions";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requirePermission(req, "promotions");
  return ok(await listCoupons());
});
export const POST = handle(async (req) => {
  const user = await requirePermission(req, "promotions");
  return ok(await saveCoupon(await parseBody(req, couponBody), user), { status: 201 });
});
