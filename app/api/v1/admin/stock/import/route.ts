import { AppError } from "@/src/lib/errors";
import { importStockCsv } from "@/src/modules/admin/stock";
import { handle, ok } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

export const POST = handle(async (req) => {
  const user = await requirePermission(req, "stock");
  const text = await req.text();
  if (text.length > 5_000_000) throw AppError.badRequest("Fichier trop volumineux (5 Mo max)");
  return ok(await importStockCsv(text, user));
});
