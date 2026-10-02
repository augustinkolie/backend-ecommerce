import { z } from "zod";

export const checkoutBody = z.object({
  email: z.email("E-mail invalide").transform((v) => v.toLowerCase().trim()),
  address: z.object({
    name: z.string().trim().min(2, "Nom requis").max(120),
    phone: z.string().trim().min(6, "Téléphone requis").max(30),
    line1: z.string().trim().max(200).default(""),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).default(""),
    country: z.string().trim().min(2).max(60).default("Guinée"),
  }),
  shippingZoneId: z.string().min(1, "Mode de livraison requis"),
  paymentMethod: z.string().min(1, "Moyen de paiement requis"),
  saveAddress: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutBody>;

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export const statusBody = z.object({
  status: z.enum(ORDER_STATUSES),
  carrier: z.string().max(80).optional(),
  trackingNumber: z.string().max(80).optional(),
  notify: z.boolean().default(true),
});

export const refundBody = z.object({
  amount: z.number().int().positive(),
  reason: z.string().max(300).default(""),
  restock: z.boolean().default(true),
});

export const noteBody = z.object({ message: z.string().trim().min(1).max(2000) });
