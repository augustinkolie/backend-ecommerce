import type { z } from "zod";
import { toErrorResponse } from "./errors";

/** Réponse de succès : { data }. */
export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ data }, init);
}

/** Enveloppe un route handler : toute exception devient une réponse d'erreur normalisée. */
export function handle<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Valide le corps JSON avec Zod (obligatoire sur chaque entrée). */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const json = await req.json().catch(() => undefined);
  return schema.parse(json);
}

/** Valide la query string avec Zod. */
export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}
