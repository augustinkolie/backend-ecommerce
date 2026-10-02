import type { ShippingZone } from "@/src/generated/prisma/client";
import { prisma } from "@/src/lib/prisma";

export async function listZones() {
  return prisma.shippingZone.findMany({ where: { active: true }, orderBy: { position: "asc" } });
}

/** Zone correspondant à une ville (sinon la zone « reste du pays », sans ville). */
export function zoneForCity(zones: ShippingZone[], city?: string | null) {
  const c = city?.trim().toLowerCase();
  const delivery = zones.filter((z) => !z.isPickup);
  if (c) {
    const exact = delivery.find((z) => z.cities.some((x) => x.toLowerCase() === c));
    if (exact) return exact;
  }
  // Sans ville connue : première zone (ordre défini dans l'admin).
  if (!c) return delivery[0] ?? null;
  return delivery.find((z) => z.cities.length === 0) ?? delivery[0] ?? null;
}

export function shippingPrice(zone: ShippingZone | null, subtotal: number, globalFreeAbove: number | null, freeShippingCoupon: boolean) {
  if (!zone) return 0;
  if (zone.isPickup || freeShippingCoupon) return 0;
  const threshold = zone.freeAbove ?? globalFreeAbove;
  if (threshold != null && subtotal >= threshold) return 0;
  return zone.price;
}
