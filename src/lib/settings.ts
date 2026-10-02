import { prisma } from "./prisma";

export type ShopSettings = {
  shopName: string;
  currency: string;
  locale: string;
  /** Taux de TVA en pour-mille (180 = 18 %), prix affichés TTC. */
  taxRate: number;
  pricesIncludeTax: boolean;
  paymentMethods: { code: string; label: string; enabled: boolean }[];
  contactEmail: string;
  contactPhone: string;
  address: string;
  freeShippingThreshold: number | null;
  emails: { abandonedCart: boolean; reviewRequest: boolean; backInStock: boolean };
};

export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "Leppi",
  currency: "GNF",
  locale: "fr-FR",
  taxRate: 180,
  pricesIncludeTax: true,
  paymentMethods: [
    { code: "cash_on_delivery", label: "Paiement à la livraison", enabled: true },
    { code: "orange_money", label: "Orange Money", enabled: false },
    { code: "mtn_momo", label: "MTN MoMo", enabled: false },
    { code: "test_card", label: "Carte (test)", enabled: true },
  ],
  contactEmail: "bonjour@leppi.local",
  contactPhone: "+224 620 00 00 00",
  address: "Kaloum, Conakry, Guinée",
  freeShippingThreshold: 1_000_000,
  emails: { abandonedCart: true, reviewRequest: true, backInStock: true },
};

export async function getSettings(): Promise<ShopSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "shop" } });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<ShopSettings>) ?? {}) };
}

export async function saveSettings(patch: Partial<ShopSettings>) {
  const next = { ...(await getSettings()), ...patch };
  await prisma.setting.upsert({
    where: { key: "shop" },
    create: { key: "shop", value: next },
    update: { value: next },
  });
  return next;
}
