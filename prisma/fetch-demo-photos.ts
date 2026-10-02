/**
 * Photos de démonstration réelles (licence Pexels : usage libre, commercial compris).
 * La sélection est figée dans prisma/demo-photos.json : produit → coloris → photos.
 * Les fichiers sont téléchargés une fois, recadrés au format de la boutique
 * (4:5, carré pour le linge, 16:7 pour la une), dans public/uploads/demo-photos.
 *
 * `npm run demo:photos` les télécharge ; le seed le fait aussi s'ils manquent.
 * Hors ligne, le seed retombe sur les silhouettes générées (demo-images.ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type DemoPhoto = { id: number; alt: string; author: string; url: string; w: number; h: number };
type Manifest = { source: string; content: Record<string, DemoPhoto>; products: Record<string, Record<string, DemoPhoto[]>> };

const MANIFEST = path.join(__dirname, "demo-photos.json");
const DIR = "demo-photos";

export const photoFile = (p: DemoPhoto) => `${DIR}/${p.id}-${p.w}x${p.h}.jpg`;

export function loadManifest(): Manifest | null {
  return existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest) : null;
}

/** Télécharge les photos absentes ; renvoie false si l'une d'elles est indisponible. */
export async function ensureDemoPhotos(uploadsDir: string, manifest: Manifest): Promise<boolean> {
  mkdirSync(path.join(uploadsDir, DIR), { recursive: true });
  const all = [...Object.values(manifest.content), ...Object.values(manifest.products).flatMap((byColor) => Object.values(byColor).flat())];
  const missing = all.filter((p) => !existsSync(path.join(uploadsDir, photoFile(p))));
  if (missing.length) console.log(`Téléchargement de ${missing.length} photos de démonstration…`);

  let failed = 0;
  // Par lots de 8 pour rester raisonnable avec le CDN.
  for (let i = 0; i < missing.length; i += 8) {
    await Promise.all(
      missing.slice(i, i + 8).map(async (p) => {
        try {
          const res = await fetch(`${p.url}?auto=compress&cs=tinysrgb&fit=crop&w=${p.w}&h=${p.h}`);
          if (!res.ok) throw new Error(String(res.status));
          writeFileSync(path.join(uploadsDir, photoFile(p)), Buffer.from(await res.arrayBuffer()));
        } catch (e) {
          failed++;
          console.warn(`  photo ${p.id} indisponible (${(e as Error).message})`);
        }
      }),
    );
  }
  return failed === 0;
}

if (require.main === module) {
  const manifest = loadManifest();
  if (!manifest) {
    console.error("prisma/demo-photos.json introuvable.");
    process.exit(1);
  }
  ensureDemoPhotos(path.join(process.cwd(), "public", "uploads"), manifest).then((ok) => {
    console.log(ok ? "Photos de démonstration prêtes." : "Certaines photos n'ont pas pu être téléchargées.");
    process.exit(ok ? 0 : 1);
  });
}
