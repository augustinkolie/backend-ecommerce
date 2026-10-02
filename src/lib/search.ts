import { Meilisearch } from "meilisearch";
import { env } from "./env";

export type ProductDocument = {
  id: string;
  slug: string;
  name: string;
  description: string;
  family: string;
  category: string;
  material: string | null;
  colors: string[];
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  publishedAt: number;
};

const INDEX = "products";
let client: Meilisearch | null | undefined;

export function meili() {
  if (client !== undefined) return client;
  const { MEILI_URL, MEILI_MASTER_KEY } = env();
  client = MEILI_URL ? new Meilisearch({ host: MEILI_URL, apiKey: MEILI_MASTER_KEY }) : null;
  return client;
}

export async function configureIndex() {
  const m = meili();
  if (!m) return;
  await m.index(INDEX).updateSettings({
    searchableAttributes: ["name", "category", "material", "colors", "description"],
    filterableAttributes: ["family", "price"],
    sortableAttributes: ["price", "publishedAt"],
    typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
  }).waitTask();
}

export async function indexProducts(docs: ProductDocument[]) {
  const m = meili();
  if (!m || docs.length === 0) return;
  try {
    await m.index<ProductDocument>(INDEX).addDocuments(docs, { primaryKey: "id" });
  } catch (err) {
    console.warn("[search] indexation impossible", (err as Error).message);
  }
}

/** Vide l'index (réindexation complète : les produits supprimés de la base ne doivent pas subsister). */
export async function clearIndex() {
  const m = meili();
  if (!m) return;
  try {
    await m.index(INDEX).deleteAllDocuments().waitTask();
  } catch (err) {
    console.warn("[search] vidage impossible", (err as Error).message);
  }
}

export async function removeProducts(ids: string[]) {
  const m = meili();
  if (!m || ids.length === 0) return;
  try {
    await m.index(INDEX).deleteDocuments(ids);
  } catch (err) {
    console.warn("[search] suppression impossible", (err as Error).message);
  }
}

/** Recherche Meilisearch ; renvoie null si le moteur est indisponible (repli SQL). */
export async function searchProducts(q: string, limit: number, offset = 0) {
  const m = meili();
  if (!m) return null;
  try {
    const res = await m.index<ProductDocument>(INDEX).search(q, { limit, offset });
    return { hits: res.hits, total: res.estimatedTotalHits ?? res.hits.length };
  } catch {
    return null;
  }
}
