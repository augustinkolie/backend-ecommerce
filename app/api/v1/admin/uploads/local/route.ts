import { AppError } from "@/src/lib/errors";
import { MAX_UPLOAD_BYTES, saveLocal } from "@/src/lib/storage";
import { handle, ok } from "@/src/lib/http";
import { requireStaff } from "@/src/lib/auth";

/** Réception binaire pour le pilote de stockage local. */
export const POST = handle(async (req) => {
  const user = await requireStaff(req);
  if (!["OWNER", "MANAGER"].includes(user.role)) throw AppError.forbidden();
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const data = await req.arrayBuffer();
  if (data.byteLength === 0 || data.byteLength > MAX_UPLOAD_BYTES) throw AppError.badRequest("Fichier vide ou trop volumineux (8 Mo max)");
  try {
    await saveLocal(key, data);
  } catch {
    throw AppError.badRequest("Clé de fichier invalide");
  }
  return ok({ key }, { status: 201 });
});
