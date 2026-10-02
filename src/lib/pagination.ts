import { z } from "zod";

/**
 * Pagination (section 7) : par curseur (?cursor=&limit=, « charger plus ») ou
 * par numéro de page (?page=&limit=, pagination numérotée). `page` l'emporte.
 */
export const cursorQuery = z.object({
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export type Page<T> = { items: T[]; nextCursor: string | null; total?: number; page?: number; pageCount?: number };

type PageParams = { cursor?: string; page?: number };

const pageInfo = (page: number | undefined, limit: number, total: number | undefined) =>
  page && total !== undefined ? { page, pageCount: Math.max(1, Math.ceil(total / limit)) } : {};

/** Curseur opaque sur un décalage (listes triées en mémoire : catalogue, facettes). */
export const encodeOffset = (offset: number) => Buffer.from(`o:${offset}`).toString("base64url");
export function decodeOffset(cursor?: string) {
  if (!cursor) return 0;
  const raw = Buffer.from(cursor, "base64url").toString();
  const n = Number(raw.replace(/^o:/, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Découpe une liste déjà chargée et triée. */
export function paginateArray<T>(all: T[], q: PageParams, limit: number): Page<T> {
  const offset = q.page ? (q.page - 1) * limit : decodeOffset(q.cursor);
  const items = all.slice(offset, offset + limit);
  const next = offset + limit;
  return { items, nextCursor: next < all.length ? encodeOffset(next) : null, total: all.length, ...pageInfo(Math.floor(offset / limit) + 1, limit, all.length) };
}

/** Arguments Prisma : décalage si `page`, sinon curseur (id). Récupère limit+1 pour savoir s'il y a une suite. */
export function prismaPage(q: PageParams, limit: number) {
  if (q.page) return { take: limit + 1, skip: (q.page - 1) * limit };
  return {
    take: limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  };
}

export function toPage<T extends { id: string }>(rows: T[], limit: number, total?: number, page?: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null, total, ...pageInfo(page, limit, total) };
}
