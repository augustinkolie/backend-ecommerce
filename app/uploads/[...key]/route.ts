import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

/** Sert les images du pilote de stockage local (en production : S3 + CDN). */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const rel = key.join("/");
  if (!/^(products|demo)\/[\w/-]+\.(jpg|png|webp|avif)$/.test(rel)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(path.join(process.cwd(), "public", "uploads", rel));
    return new Response(file, {
      headers: { "content-type": TYPES[rel.split(".").pop()!]!, "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
