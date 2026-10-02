import { Redis } from "ioredis";
import { env } from "./env";

const g = globalThis as unknown as { redis?: Redis | null };

/** Client Redis partagé, ou null si REDIS_URL est absent (repli en mémoire). */
export function redis(): Redis | null {
  if (g.redis !== undefined) return g.redis;
  const url = env().REDIS_URL;
  if (!url) return (g.redis = null);
  const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false, enableOfflineQueue: false });
  client.on("error", () => {
    /* indisponible : les appelants se replient */
  });
  return (g.redis = client);
}
