import { z } from "zod";
import { AppError } from "@/src/lib/errors";
import { handle, ok, parseBody } from "@/src/lib/http";
import { prisma } from "@/src/lib/prisma";
import { rateLimit } from "@/src/lib/rate-limit";

const body = z.object({ variantId: z.string().min(1), email: z.email("E-mail invalide").transform((v) => v.toLowerCase()) });

/** « Alerte retour en stock » par e-mail. */
export const POST = handle(async (req) => {
  await rateLimit(req, "stock-alert", 20, 3600);
  const { variantId, email } = await parseBody(req, body);
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, deletedAt: null } });
  if (!variant) throw AppError.notFound("Article introuvable");
  await prisma.backInStockAlert.upsert({
    where: { variantId_email: { variantId, email } },
    create: { variantId, email },
    update: { notifiedAt: null },
  });
  return ok({ subscribed: true }, { status: 201 });
});
