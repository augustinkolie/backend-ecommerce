// Test de charge de l'API catalogue (section 8 : réponse p95 < 150 ms).
// Usage : npm run loadtest -- [URL de base] [requêtes par route] [concurrence]
//   npm run loadtest                         → http://localhost:4000, 300 requêtes, 20 en parallèle
//   npm run loadtest -- https://api.leppi.gn 1000 50
const base = (process.argv[2] ?? "http://localhost:4000").replace(/\/$/, "");
const total = Number(process.argv[3] ?? 300);
const concurrency = Number(process.argv[4] ?? 20);
const SEUIL_MS = 150;

async function json(path) {
  const res = await fetch(`${base}/api/v1${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()).data;
}

// Routes catalogue réelles, construites depuis les données présentes.
// /search est exclu : il est limité à 120 requêtes/min par adresse IP (protection anti-abus).
const list = await json("/products?limit=24");
const slugs = list.items.map((p) => p.slug);
const categories = (await json("/categories")).flatMap((c) => [c.slug, ...c.children.map((x) => x.slug)]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const routes = {
  "GET /products (catégorie + tri)": () => `/products?category=${pick(categories)}&sort=price_asc&limit=24`,
  "GET /products (filtres)": () => `/products?category=${pick(categories)}&color=Blanc&limit=24`,
  "GET /products/:slug": () => `/products/${pick(slugs)}`,
  "GET /categories": () => "/categories",
};

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

let failed = false;
console.log(`Charge : ${total} requêtes par route, ${concurrency} en parallèle, sur ${base}\n`);
console.log("Route".padEnd(34), "p50".padStart(7), "p95".padStart(7), "p99".padStart(7), "req/s".padStart(7), "erreurs".padStart(8), " verdict");
for (const [name, path] of Object.entries(routes)) {
  // Échauffement (caches, JIT).
  await Promise.all(Array.from({ length: 10 }, () => fetch(`${base}/api/v1${path()}`).then((r) => r.arrayBuffer())));
  const times = [];
  let errors = 0;
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < total) {
        next++;
        const t0 = performance.now();
        try {
          const res = await fetch(`${base}/api/v1${path()}`);
          await res.arrayBuffer();
          if (!res.ok) errors++;
        } catch {
          errors++;
        }
        times.push(performance.now() - t0);
      }
    }),
  );
  const elapsed = (performance.now() - started) / 1000;
  times.sort((a, b) => a - b);
  const p95 = pct(times, 95);
  const ok = p95 < SEUIL_MS && errors === 0;
  failed ||= !ok;
  console.log(
    name.padEnd(34),
    `${pct(times, 50).toFixed(0)} ms`.padStart(7),
    `${p95.toFixed(0)} ms`.padStart(7),
    `${pct(times, 99).toFixed(0)} ms`.padStart(7),
    (times.length / elapsed).toFixed(0).padStart(7),
    String(errors).padStart(8),
    ok ? " OK" : ` ÉCHEC (seuil p95 < ${SEUIL_MS} ms)`,
  );
}
process.exit(failed ? 1 : 0);
