import { isServiceRequest } from "./auth";
import { AppError } from "./errors";
import { redis } from "./redis";

const memory = new Map<string, { count: number; reset: number }>();

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/**
 * Fenêtre fixe : `limit` requêtes par `windowSeconds` et par IP.
 * Redis si disponible, sinon mémoire du processus.
 */
export async function rateLimit(req: Request, bucket: string, limit: number, windowSeconds: number) {
  if (isServiceRequest(req) && !req.headers.get("x-forwarded-for")) return;
  const key = `rl:${bucket}:${clientIp(req)}`;

  let count: number;
  const r = redis();
  try {
    if (!r || r.status !== "ready") throw new Error("redis indisponible");
    count = await r.incr(key);
    if (count === 1) await r.expire(key, windowSeconds);
  } catch {
    const now = Date.now();
    const entry = memory.get(key);
    if (!entry || entry.reset < now) {
      memory.set(key, { count: 1, reset: now + windowSeconds * 1000 });
      count = 1;
    } else {
      count = ++entry.count;
    }
  }

  if (count > limit) {
    throw new AppError(429, "RATE_LIMITED", "Trop de tentatives, réessayez dans quelques minutes.");
  }
}
