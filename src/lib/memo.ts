/**
 * Cache mémoire court, par processus, pour les lectures du catalogue public
 * (section 8 : réponse API catalogue p95 < 150 ms).
 *
 * - Une valeur est partagée par toutes les requêtes concurrentes (une seule requête SQL).
 * - Elle expire après `ttlMs` ; une erreur n'est jamais mise en cache.
 * - `clearMemo(prefix)` est appelé à chaque modification du catalogue (lib/revalidate).
 * Le stock en temps réel (fiche produit) et le panier ne passent jamais par ce cache.
 */
const entries = new Map<string, { expires: number; value: Promise<unknown> }>();

export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  const value = load();
  entries.set(key, { expires: now + ttlMs, value });
  value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key);
  });
  return value;
}

export function clearMemo(prefix = "") {
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}
