import { orderPdf } from "@/src/modules/admin/orders";
import { handle } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";
import type { Ctx } from "@/src/lib/params";

export const dynamic = "force-dynamic";
export const GET = handle(async (req, ctx: Ctx<{ id: string }>) => {
  await requirePermission(req, "orders");
  const bytes = await orderPdf((await ctx.params).id, "invoice");
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": 'inline; filename="facture.pdf"' } });
});
