import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import type { Prisma } from "@/src/generated/prisma/client";
import { toCsv } from "@/src/lib/csv";
import { AppError } from "@/src/lib/errors";
import { prismaPage, toPage } from "@/src/lib/pagination";
import { prisma } from "@/src/lib/prisma";
import { getSettings } from "@/src/lib/settings";
import { ORDER_STATUSES } from "../orders/schema";
import { orderDetailInclude } from "../orders/service";

export const orderListQuery = z.object({
  q: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  payment: z.string().optional(),
  zone: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function whereFor(q: z.infer<typeof orderListQuery>): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.payment) where.paymentMethod = q.payment;
  if (q.zone) where.shippingZoneId = q.zone;
  if (q.from || q.to) where.createdAt = { gte: q.from, lte: q.to };
  if (q.q) {
    const n = Number(q.q.replace(/^#/, ""));
    where.OR = [
      ...(Number.isInteger(n) ? [{ number: n }] : []),
      { email: { contains: q.q, mode: "insensitive" } },
      { user: { name: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listOrders(q: z.infer<typeof orderListQuery>) {
  const where = whereFor(q);
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...prismaPage(q, q.limit),
      include: { user: { select: { name: true } }, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  return toPage(
    rows.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      email: o.email,
      customer: o.user?.name ?? (o.shippingAddress as { name?: string }).name ?? o.email,
      total: o.total,
      currency: o.currency,
      paymentMethod: o.paymentMethod,
      shippingMethod: o.shippingMethod,
      itemCount: o._count.items,
      createdAt: o.createdAt,
    })),
    q.limit,
    total,
    q.page,
  );
}

export async function exportOrdersCsv(q: z.infer<typeof orderListQuery>) {
  const rows = await prisma.order.findMany({ where: whereFor(q), orderBy: { createdAt: "desc" }, take: 10_000 });
  return toCsv(
    rows.map((o) => ({ numero: o.number, date: o.createdAt.toISOString(), statut: o.status, email: o.email, total: o.total, devise: o.currency, paiement: o.paymentMethod, livraison: o.shippingMethod })),
    ["numero", "date", "statut", "email", "total", "devise", "paiement", "livraison"],
  );
}

export async function getOrder(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
  if (!o) throw AppError.notFound("Commande introuvable");
  return o;
}

// ---------------------------------------------------------------- PDF : facture et bon de préparation

function money(amount: number, currency: string) {
  const digits = currency === "EUR" ? 2 : 0;
  const n = (amount / 10 ** digits).toFixed(digits).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n} ${currency}`;
}

/** Les polices standard PDF ne couvrent que WinAnsi : on remplace les caractères hors jeu. */
const safe = (s: string) => s.replace(/[×]/g, "x").replace(/[  ]/g, " ").replace(/[^\x20-\x7E -ÿ€]/g, "");

export async function orderPdf(id: string, kind: "invoice" | "packing") {
  const [o, settings] = await Promise.all([getOrder(id), getSettings()]);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.42, 0.39, 0.36);
  const line = rgb(0.89, 0.86, 0.82);
  let y = 790;
  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(safe(s), { x, y, size, font: f, color });

  text(settings.shopName, 48, 20, bold);
  text(kind === "invoice" ? "FACTURE" : "BON DE PRÉPARATION", 400, 12, bold);
  y -= 18;
  text(settings.address, 48, 9, font, muted);
  text(`Commande n° ${o.number}`, 400, 10);
  y -= 14;
  text(settings.contactEmail, 48, 9, font, muted);
  text(`Date : ${o.createdAt.toLocaleDateString("fr-FR")}`, 400, 10);

  y -= 40;
  const addr = o.shippingAddress as { name: string; phone: string; line1: string; line2?: string; city: string; country: string };
  text(kind === "invoice" ? "Facturé à" : "Livrer à", 48, 9, bold, muted);
  y -= 14;
  for (const l of [addr.name, addr.line1, addr.line2, `${addr.city}, ${addr.country}`, addr.phone, o.email].filter(Boolean) as string[]) {
    text(l, 48);
    y -= 13;
  }
  text(`Livraison : ${o.shippingMethod}`, 320, 10);

  y -= 24;
  page.drawLine({ start: { x: 48, y: y + 12 }, end: { x: 547, y: y + 12 }, color: line });
  text("Article", 48, 9, bold, muted);
  text("SKU", 290, 9, bold, muted);
  text("Qté", 390, 9, bold, muted);
  if (kind === "invoice") text("Total", 480, 9, bold, muted);
  else text("Préparé", 480, 9, bold, muted);
  y -= 18;
  for (const i of o.items) {
    const attrs = (i.attributes as { value: string }[]).map((a) => a.value).join(" · ");
    text(i.name.slice(0, 44), 48);
    text(i.sku, 290, 9);
    text(String(i.quantity), 395);
    if (kind === "invoice") text(money(i.unitPrice * i.quantity, o.currency), 480, 9);
    else page.drawRectangle({ x: 490, y: y - 2, width: 10, height: 10, borderColor: ink, borderWidth: 1 });
    y -= 12;
    text(attrs, 48, 8, font, muted);
    y -= 16;
    if (y < 120) break;
  }
  page.drawLine({ start: { x: 48, y: y + 8 }, end: { x: 547, y: y + 8 }, color: line });

  if (kind === "invoice") {
    y -= 12;
    const rows: [string, string][] = [
      ["Sous-total", money(o.subtotal, o.currency)],
      ...(o.discountTotal ? ([["Remise", `-${money(o.discountTotal, o.currency)}`]] as [string, string][]) : []),
      ["Livraison", o.shippingTotal ? money(o.shippingTotal, o.currency) : "Offerte"],
      ["Total TTC", money(o.total, o.currency)],
    ];
    for (const [k, v] of rows) {
      text(k, 380, 10, k === "Total TTC" ? bold : font);
      text(v, 480, 10, k === "Total TTC" ? bold : font);
      y -= 16;
    }
    const tax = Math.round(o.total - o.total / (1 + settings.taxRate / 1000));
    text(`dont TVA (${settings.taxRate / 10} %) : ${money(tax, o.currency)}`, 380, 8, font, muted);
  } else if (o.internalNotes) {
    y -= 12;
    text(`Note client : ${o.internalNotes.slice(0, 90)}`, 48, 9, font, muted);
  }

  return pdf.save();
}
