import type { Role } from "@/src/generated/prisma/client";

export type Permission =
  | "dashboard"
  | "orders"
  | "orders.status"
  | "orders.refund"
  | "orders.refund.unlimited"
  | "products"
  | "stock"
  | "customers"
  | "promotions"
  | "reviews"
  | "content"
  | "settings"
  | "team";

/** Section 5 — rôles. Propriétaire : tout. */
const matrix: Record<Exclude<Role, "CUSTOMER">, Permission[] | "*"> = {
  OWNER: "*",
  MANAGER: ["dashboard", "orders", "orders.status", "orders.refund", "orders.refund.unlimited", "products", "stock", "promotions", "content"],
  SUPPORT: ["orders", "orders.status", "orders.refund", "customers", "reviews"],
  STOCK: ["orders", "orders.status", "stock"],
};

export const STAFF_ROLES = ["OWNER", "MANAGER", "SUPPORT", "STOCK"] as const;

export function can(role: Role, permission: Permission) {
  if (role === "CUSTOMER") return false;
  const perms = matrix[role];
  return perms === "*" || perms.includes(permission);
}

export function permissionsFor(role: Role): Permission[] {
  if (role === "CUSTOMER") return [];
  const perms = matrix[role];
  if (perms !== "*") return perms;
  return [
    "dashboard", "orders", "orders.status", "orders.refund", "orders.refund.unlimited", "products", "stock",
    "customers", "promotions", "reviews", "content", "settings", "team",
  ];
}

/** Seuil de remboursement du service client (plus petite unité de la devise). */
export const SUPPORT_REFUND_LIMIT = 500_000;
