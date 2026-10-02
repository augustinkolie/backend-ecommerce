import { z } from "zod";
import { AppError } from "@/src/lib/errors";
import { createUpload, extensionFor } from "@/src/lib/storage";
import { handle, ok, parseBody } from "@/src/lib/http";
import { requireStaff } from "@/src/lib/auth";

const body = z.object({ contentType: z.string() });

/** URL signée d'upload (S3) ou URL locale. */
export const POST = handle(async (req) => {
  const user = await requireStaff(req);
  if (!["OWNER", "MANAGER"].includes(user.role)) throw AppError.forbidden();
  const { contentType } = await parseBody(req, body);
  if (!extensionFor(contentType)) throw AppError.badRequest("Format accepté : JPEG, PNG, WebP, AVIF");
  return ok(await createUpload(contentType), { status: 201 });
});
