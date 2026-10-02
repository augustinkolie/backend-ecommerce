import { env } from "./env";
import { clearMemo } from "./memo";

/**
 * Flux n°3 : après une modification admin, le backend demande au frontend
 * de revalider les pages concernées (revalidateTag). Ne bloque jamais l'admin.
 */
export async function revalidateFrontend(tags: string[], { immediate = false } = {}) {
  // Toute modification admin du catalogue vide aussi le cache mémoire de l'API (lib/memo).
  clearMemo("catalog:");
  const { FRONTEND_INTERNAL_URL, FRONTEND_URL, REVALIDATE_SECRET } = env();
  if (!REVALIDATE_SECRET || tags.length === 0) return;
  try {
    await fetch(`${FRONTEND_INTERNAL_URL ?? FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": REVALIDATE_SECRET },
      body: JSON.stringify({ tags: [...new Set(tags)], immediate }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.warn("[revalidate] frontend injoignable", (err as Error).message);
  }
}
