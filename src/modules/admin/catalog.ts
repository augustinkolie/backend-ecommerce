import { z } from "zod";
import { audit } from "@/src/lib/audit";
import type { AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prisma } from "@/src/lib/prisma";
import { revalidateFrontend } from "@/src/lib/revalidate";
import { slugify } from "@/src/lib/slug";

// ---------------------------------------------------------------- Catégories

export const categoryBody = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  slug: z.string().trim().max(80).optional(),
  parentId: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

export const reorderBody = z.object({
  items: z.array(z.object({ id: z.string(), parentId: z.string().nullable(), position: z.number().int().min(0) })).max(500),
});

export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, position: c.position, image: c.image, productCount: c._count.products }));
}

export async function saveCategory(input: z.infer<typeof categoryBody>, author: AuthUser, id?: string) {
  const slug = slugify(input.slug || input.name);
  const clash = await prisma.category.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw AppError.conflict("Ce slug est déjà utilisé.");
  if (id && input.parentId === id) throw AppError.badRequest("Une catégorie ne peut pas être sa propre parente.");
  const before = id ? await prisma.category.findUnique({ where: { id } }) : null;
  const position = id ? undefined : await prisma.category.count({ where: { parentId: input.parentId ?? null } });
  const saved = id
    ? await prisma.category.update({ where: { id }, data: { name: input.name, slug, parentId: input.parentId ?? null, image: input.image ?? null } })
    : await prisma.category.create({ data: { name: input.name, slug, parentId: input.parentId ?? null, image: input.image ?? null, position } });
  await audit(author, id ? "category.update" : "category.create", "Category", saved.id, before ?? undefined, saved);
  await revalidateFrontend(["catalog", "categories"]);
  return saved;
}

/** Glisser-déposer : nouvelle position et nouveau parent pour chaque nœud. */
export async function reorderCategories(input: z.infer<typeof reorderBody>, author: AuthUser) {
  const ids = new Set(input.items.map((i) => i.id));
  const parent = new Map(input.items.map((i) => [i.id, i.parentId]));
  for (const i of input.items) {
    // Pas de cycle : on remonte les parents.
    const seen = new Set<string>();
    let cur: string | null | undefined = i.parentId;
    while (cur) {
      if (cur === i.id || seen.has(cur)) throw AppError.badRequest("Arborescence invalide (cycle).");
      seen.add(cur);
      cur = parent.get(cur) ?? (ids.has(cur) ? null : undefined);
    }
  }
  await prisma.$transaction(
    input.items.map((i) => prisma.category.update({ where: { id: i.id }, data: { parentId: i.parentId, position: i.position } })),
  );
  await audit(author, "category.reorder", "Category", "tree", undefined, input.items);
  await revalidateFrontend(["catalog", "categories"]);
}

export async function deleteCategory(id: string, author: AuthUser) {
  const [products, children] = await Promise.all([
    prisma.product.count({ where: { categoryId: id, deletedAt: null } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);
  if (products || children) throw AppError.conflict("Catégorie non vide : déplacez d'abord ses produits et sous-catégories.");
  const before = await prisma.category.delete({ where: { id } });
  await audit(author, "category.delete", "Category", id, before);
  await revalidateFrontend(["catalog", "categories"]);
}

// ---------------------------------------------------------------- Collections

export const collectionBody = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  slug: z.string().trim().max(80).optional(),
  type: z.enum(["MANUAL", "AUTO"]),
  rules: z
    .object({
      family: z.enum(["LINEN", "CLOTHING", "TSHIRT", "SHOES"]).optional(),
      material: z.string().optional(),
      newDays: z.number().int().positive().optional(),
      minPrice: z.number().int().min(0).optional(),
      maxPrice: z.number().int().min(0).optional(),
    })
    .nullable()
    .optional(),
  productIds: z.array(z.string()).default([]),
});

export async function listCollections() {
  const rows = await prisma.collection.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  return rows.map((c) => ({ ...c, productCount: c._count.products }));
}

export async function getCollection(id: string) {
  const c = await prisma.collection.findUnique({ where: { id }, include: { products: { select: { id: true, name: true } } } });
  if (!c) throw AppError.notFound("Collection introuvable");
  return c;
}

export async function saveCollection(input: z.infer<typeof collectionBody>, author: AuthUser, id?: string) {
  const slug = slugify(input.slug || input.name);
  const clash = await prisma.collection.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw AppError.conflict("Ce slug est déjà utilisé.");
  const products = input.type === "MANUAL" ? input.productIds.map((pid) => ({ id: pid })) : [];
  const data = { name: input.name, slug, type: input.type, rules: input.type === "AUTO" ? (input.rules ?? {}) : undefined };
  const saved = id
    ? await prisma.collection.update({ where: { id }, data: { ...data, products: { set: products } } })
    : await prisma.collection.create({ data: { ...data, products: { connect: products } } });
  await audit(author, id ? "collection.update" : "collection.create", "Collection", saved.id, undefined, input);
  await revalidateFrontend(["catalog", `collection:${saved.slug}`]);
  return saved;
}

export async function deleteCollection(id: string, author: AuthUser) {
  const before = await prisma.collection.delete({ where: { id } });
  await audit(author, "collection.delete", "Collection", id, before);
  await revalidateFrontend(["catalog"]);
}

// ---------------------------------------------------------------- Attributs

export const attributeTypeBody = z.object({
  code: z.string().trim().regex(/^[a-z_]+$/, "Minuscules et _ uniquement").max(40),
  name: z.string().trim().min(1).max(60),
  families: z.array(z.enum(["LINEN", "CLOTHING", "TSHIRT", "SHOES"])).default([]),
  position: z.number().int().min(0).default(0),
});

export const attributeValueBody = z.object({
  value: z.string().trim().min(1, "Valeur requise").max(60),
  hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Format #RRGGBB")
    .nullable()
    .optional(),
  position: z.number().int().min(0).default(0),
});

export async function listAttributes() {
  return prisma.attributeType.findMany({
    orderBy: { position: "asc" },
    include: { values: { orderBy: [{ position: "asc" }, { value: "asc" }], include: { _count: { select: { variants: true } } } } },
  });
}

export async function saveAttributeType(input: z.infer<typeof attributeTypeBody>, author: AuthUser, id?: string) {
  const saved = id
    ? await prisma.attributeType.update({ where: { id }, data: input })
    : await prisma.attributeType.create({ data: input });
  await audit(author, id ? "attribute.update" : "attribute.create", "AttributeType", saved.id, undefined, input);
  return saved;
}

export async function saveAttributeValue(typeId: string, input: z.infer<typeof attributeValueBody>, author: AuthUser, id?: string) {
  const clash = await prisma.attributeValue.findFirst({ where: { typeId, value: input.value, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw AppError.conflict("Cette valeur existe déjà.");
  const saved = id
    ? await prisma.attributeValue.update({ where: { id }, data: { value: input.value, hex: input.hex ?? null, position: input.position } })
    : await prisma.attributeValue.create({ data: { typeId, value: input.value, hex: input.hex ?? null, position: input.position } });
  await audit(author, id ? "attribute_value.update" : "attribute_value.create", "AttributeValue", saved.id, undefined, input);
  if (id) await revalidateFrontend(["catalog"]);
  return saved;
}

export async function deleteAttributeValue(id: string, author: AuthUser) {
  const used = await prisma.productVariant.count({ where: { attributeValues: { some: { id } }, deletedAt: null } });
  if (used) throw AppError.conflict(`Valeur utilisée par ${used} variante(s).`);
  const before = await prisma.attributeValue.delete({ where: { id } });
  await audit(author, "attribute_value.delete", "AttributeValue", id, before);
}
