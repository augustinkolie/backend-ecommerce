/**
 * Visuels de démonstration : silhouette du produit en couleur pleine sur fond lin.
 * PNG écrit à la main (zlib) pour n'ajouter aucune dépendance.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

type Pt = [number, number];
type Shape = { poly: Pt[]; shade?: number };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function inside(x: number, y: number, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function render(w: number, h: number, bg: string, color: string, shapes: Shape[]) {
  const [br, bgc, bb] = hex(bg);
  const [cr, cg, cb] = hex(color);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  // Coordonnées normalisées 0..1 → pixels.
  const polys = shapes.map((s) => ({ shade: s.shade ?? 1, pts: s.poly.map(([x, y]) => [x * w, y * h] as Pt) }));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      let r = br, g = bgc, b = bb;
      for (const p of polys) {
        if (inside(x + 0.5, y + 0.5, p.pts)) {
          r = Math.round(cr * p.shade);
          g = Math.round(cg * p.shade);
          b = Math.round(cb * p.shade);
        }
      }
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SHAPES: Record<string, Shape[]> = {
  tshirt: [{ poly: [[0.3, 0.22], [0.42, 0.18], [0.5, 0.23], [0.58, 0.18], [0.7, 0.22], [0.86, 0.36], [0.77, 0.44], [0.7, 0.38], [0.7, 0.8], [0.3, 0.8], [0.3, 0.38], [0.23, 0.44], [0.14, 0.36]] }],
  shirt: [
    { poly: [[0.32, 0.2], [0.44, 0.17], [0.5, 0.24], [0.56, 0.17], [0.68, 0.2], [0.82, 0.3], [0.86, 0.66], [0.78, 0.67], [0.72, 0.38], [0.72, 0.82], [0.28, 0.82], [0.28, 0.38], [0.22, 0.67], [0.14, 0.66], [0.18, 0.3]] },
    { poly: [[0.495, 0.25], [0.505, 0.25], [0.505, 0.82], [0.495, 0.82]], shade: 0.8 },
  ],
  dress: [{ poly: [[0.4, 0.16], [0.46, 0.2], [0.54, 0.2], [0.6, 0.16], [0.64, 0.3], [0.6, 0.42], [0.76, 0.84], [0.24, 0.84], [0.4, 0.42], [0.36, 0.3]] }],
  pants: [{ poly: [[0.33, 0.16], [0.67, 0.16], [0.72, 0.86], [0.56, 0.86], [0.5, 0.36], [0.44, 0.86], [0.28, 0.86]] }],
  sneaker: [
    { poly: [[0.14, 0.58], [0.3, 0.46], [0.48, 0.44], [0.6, 0.5], [0.84, 0.56], [0.88, 0.64], [0.14, 0.64]] },
    { poly: [[0.12, 0.64], [0.9, 0.64], [0.9, 0.69], [0.12, 0.69]], shade: 0.7 },
  ],
  sandal: [
    { poly: [[0.14, 0.64], [0.88, 0.62], [0.9, 0.68], [0.14, 0.7]], shade: 0.75 },
    { poly: [[0.3, 0.64], [0.36, 0.52], [0.44, 0.52], [0.4, 0.64]] },
    { poly: [[0.56, 0.63], [0.62, 0.5], [0.72, 0.5], [0.68, 0.63]] },
  ],
  derby: [
    { poly: [[0.14, 0.6], [0.26, 0.48], [0.5, 0.46], [0.66, 0.5], [0.86, 0.56], [0.88, 0.64], [0.14, 0.64]] },
    { poly: [[0.14, 0.64], [0.88, 0.64], [0.88, 0.67], [0.14, 0.67]], shade: 0.55 },
  ],
  linen: [
    { poly: [[0.18, 0.56], [0.82, 0.56], [0.82, 0.7], [0.18, 0.7]], shade: 0.85 },
    { poly: [[0.2, 0.44], [0.8, 0.44], [0.8, 0.56], [0.2, 0.56]] },
    { poly: [[0.22, 0.33], [0.78, 0.33], [0.78, 0.44], [0.22, 0.44]], shade: 0.92 },
  ],
  pillow: [{ poly: [[0.2, 0.34], [0.5, 0.3], [0.8, 0.34], [0.84, 0.5], [0.8, 0.66], [0.5, 0.7], [0.2, 0.66], [0.16, 0.5]] }],
};

const BG = ["#EFEAE2", "#E6E0D6"];

/** Écrit l'image si besoin et renvoie son chemin public relatif (demo/...). */
export function demoImage(outDir: string, shape: keyof typeof SHAPES, color: string, variant: 0 | 1, square: boolean) {
  const name = `${shape}-${color.slice(1).toLowerCase()}-${variant}${square ? "-sq" : ""}.png`;
  const rel = `demo/${name}`;
  const file = path.join(outDir, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  const w = 480;
  const h = square ? 480 : 600;
  // Variante 1 : cadrage serré (détail).
  const shapes = variant === 1
    ? SHAPES[shape]!.map((s) => ({ ...s, poly: s.poly.map(([x, y]) => [(x - 0.5) * 1.6 + 0.5, (y - 0.5) * 1.6 + 0.5] as Pt) }))
    : SHAPES[shape]!;
  writeFileSync(file, render(w, h, BG[variant]!, color, shapes));
  return rel;
}
