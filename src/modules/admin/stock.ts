import { z } from "zod";
import type { Prisma } from "@/src/generated/prisma/client";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { parseCsv, toCsv } from "@/src/lib/csv";
import { AppError } from "@/src/lib/errors";
import { prismaPage, toPage } from "@/src/lib/pagination";
import { prisma } from "@/src/lib/prisma";
import { afterCatalogChange } from "./products";

export const stockListQuery = z.object({
  q: z.string().optional(),
  level: z.enum(["low", "out", "all"]).default("all"),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const adjustBody = z.object({
  variantId: z.string(),
  type: z.enum(["IN", "RETURN", "ADJUSTMENT"]),
  /** IN/RETURN : quantité positive ajoutée. ADJUSTMENT : nouveau niveau absolu. */
  quantity: z.number().int(),
  reason: z.string().trim().max(200).default(""),
});

export const movementQuery = z.object({
  variantId: z.string().optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const variantSelect = {
  id: true,
  sku: true,
  stock: true,
  stockReserved: true,
  lowStockAlert: true,
  price: true,
  product: { select: { id: true, name: true, family: true } },
  attributeValues: {
    select: { value: true, type: { select: { position: true } } },
  },
} satisfies Prisma.ProductVariantSelect;

function label(v: { attributeValues: { value: string; type: { position: number } }[] }) {
  return [...v.attributeValues]
    .sort((a, b) => a.type.position - b.type.position)
    .map((a) => a.value)
    .join(" · ");
}

export async function listStock(q: z.infer<typeof stockListQuery>) {
  const where: Prisma.ProductVariantWhereInput = {
    deletedAt: null,
    product: { deletedAt: null },
  };
  if (q.q) {
    where.OR = [{ sku: { contains: q.q, mode: "insensitive" } }, { product: { name: { contains: q.q, mode: "insensitive" } } }];
  }
  const rows = await prisma.productVariant.findMany({
    where,
    select: variantSelect,
    orderBy: [{ stock: "asc" }, { id: "asc" }],
  });
  const items = rows
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      productId: v.product.id,
      productName: v.product.name,
      variant: label(v),
      stock: v.stock,
      reserved: v.stockReserved,
      available: v.stock - v.stockReserved,
      lowStockAlert: v.lowStockAlert,
      level: v.stock - v.stockReserved <= 0 ? "out" : v.stock - v.stockReserved <= v.lowStockAlert ? "low" : "ok",
    }))
    .filter((v) => q.level === "all" || (q.level === "out" ? v.level === "out" : v.level !== "ok"));
  const start = q.page ? (q.page - 1) * q.limit : q.cursor ? items.findIndex((i) => i.id === q.cursor) + 1 : 0;
  return toPage(items.slice(start, start + q.limit + 1), q.limit, items.length, q.page);
}

export async function adjustStock(input: z.infer<typeof adjustBody>, author: AuthUser) {
  const v = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
  });
  if (!v) throw AppError.notFound("Variante introuvable");
  const delta = input.type === "ADJUSTMENT" ? input.quantity - v.stock : Math.abs(input.quantity);
  if (v.stock + delta < v.stockReserved) throw AppError.badRequest("Le stock ne peut pas être inférieur aux quantités réservées.");
  if (delta === 0) return v;
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.productVariant.update({
      where: { id: v.id },
      data: { stock: { increment: delta } },
    });
    await tx.stockMovement.create({
      data: {
        variantId: v.id,
        type: input.type,
        quantity: delta,
        reason: input.reason || null,
        authorId: author.id,
      },
    });
    await audit(author, "stock.adjust", "ProductVariant", v.id, { stock: v.stock }, { stock: u.stock, type: input.type }, tx);
    return u;
  });
  await afterCatalogChange([v.productId]);
  return updated;
}

export async function listMovements(q: z.infer<typeof movementQuery>) {
  const where = q.variantId ? { variantId: q.variantId } : {};
  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...prismaPage(q, q.limit),
      include: {
        author: { select: { name: true, email: true } },
        variant: { select: variantSelect },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return toPage(
    rows.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      createdAt: m.createdAt,
      author: m.author?.name ?? m.author?.email ?? "Système",
      sku: m.variant.sku,
      productName: m.variant.product.name,
      variant: label(m.variant),
    })),
    q.limit,
    total,
    q.page,
  );
}

export async function exportStockCsv() {
  const rows = await prisma.productVariant.findMany({
    where: { deletedAt: null, product: { deletedAt: null } },
    select: variantSelect,
    orderBy: { sku: "asc" },
  });
  return toCsv(
    rows.map((v) => ({
      sku: v.sku,
      produit: v.product.name,
      variante: label(v),
      stock: v.stock,
      reserve: v.stockReserved,
      seuil_alerte: v.lowStockAlert,
    })),
    ["sku", "produit", "variante", "stock", "reserve", "seuil_alerte"],
  );
}

/** Import CSV : colonnes sku ; stock [; seuil_alerte]. Le stock importé est un niveau absolu. */
export async function importStockCsv(text: string, author: AuthUser) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw AppError.badRequest("Fichier vide ou illisible");
  const errors: { line: number; message: string }[] = [];
  let updated = 0;
  const touched = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const line = i + 2;
    const sku = row.sku;
    const stock = Number(row.stock);
    if (!sku || !Number.isInteger(stock) || stock < 0) {
      errors.push({ line, message: "sku ou stock invalide" });
      continue;
    }
    const v = await prisma.productVariant.findUnique({ where: { sku } });
    if (!v || v.deletedAt) {
      errors.push({ line, message: `SKU inconnu : ${sku}` });
      continue;
    }
    const threshold = row.seuil_alerte ? Number(row.seuil_alerte) : undefined;
    if (stock < v.stockReserved) {
      errors.push({
        line,
        message: `${sku} : stock inférieur aux réservations (${v.stockReserved})`,
      });
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: v.id },
        data: {
          stock,
          ...(Number.isInteger(threshold) ? { lowStockAlert: threshold } : {}),
        },
      });
      if (stock !== v.stock) {
        await tx.stockMovement.create({
          data: {
            variantId: v.id,
            type: "ADJUSTMENT",
            quantity: stock - v.stock,
            reason: "Import CSV",
            authorId: author.id,
          },
        });
      }
    });
    touched.add(v.productId);
    updated++;
  }
  await audit(author, "stock.import", "ProductVariant", "csv", undefined, {
    updated,
    errors: errors.length,
  });
  if (touched.size) await afterCatalogChange([...touched]);
  return { updated, errors };
}
