/** Contexte d'un route handler dynamique (Next.js : params est une promesse). */
export type Ctx<P extends Record<string, string | string[]>> = { params: Promise<P> };
