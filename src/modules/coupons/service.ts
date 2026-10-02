import type { Coupon } from "@/src/generated/prisma/client";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";

export async function findValidCoupon(code: string, subtotal: number) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const reason = couponProblem(coupon, subtotal);
  if (reason) throw AppError.badRequest(reason, { code: [reason] });
  return coupon!;
}

export function couponProblem(coupon: Coupon | null, subtotal: number): string | null {
  const now = new Date();
  if (!coupon) return "Code promo inconnu.";
  if (coupon.startsAt && coupon.startsAt > now) return "Ce code n'est pas encore actif.";
  if (coupon.endsAt && coupon.endsAt < now) return "Ce code a expiré.";
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return "Ce code a atteint sa limite d'utilisation.";
  if (coupon.minimum != null && subtotal < coupon.minimum) return "Montant minimum non atteint pour ce code.";
  return null;
}

/** Remise en plus petite unité. PERCENT : value = pourcentage ; AMOUNT : value = montant. */
export function couponDiscount(coupon: Coupon | null, subtotal: number) {
  if (!coupon) return 0;
  if (coupon.type === "PERCENT") return Math.round((subtotal * Math.min(coupon.value, 100)) / 100);
  if (coupon.type === "AMOUNT") return Math.min(coupon.value, subtotal);
  return 0;
}
