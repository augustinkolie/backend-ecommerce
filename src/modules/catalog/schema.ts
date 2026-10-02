import { z } from "zod";

const list = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

export const productListQuery = z.object({
  category: z.string().optional(),
  collection: z.string().optional(),
  family: z.enum(["LINEN", "CLOTHING", "TSHIRT", "SHOES"]).optional(),
  size: list,
  shoe_size: list,
  dimension: list,
  color: list,
  material: list,
  price_min: z.coerce.number().int().min(0).optional(),
  price_max: z.coerce.number().int().min(0).optional(),
  on_sale: z.enum(["1", "true"]).optional(),
  sort: z.enum(["new", "price_asc", "price_desc", "best", "relevance"]).default("new"),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export type ProductListQuery = z.infer<typeof productListQuery>;

export const FACET_CODES = ["size", "shoe_size", "dimension", "color"] as const;
export type FacetCode = (typeof FACET_CODES)[number];
