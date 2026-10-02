/**
 * Planificateur des tâches : `npm run jobs`.
 * En production, on peut aussi appeler POST /api/v1/internal/jobs depuis un cron (en-tête x-jobs-secret).
 */
import "dotenv/config";
import { runAll } from "./index";

const INTERVAL = 60_000;

async function tick() {
  const started = Date.now();
  const results = await runAll();
  console.log(`[jobs] ${new Date().toISOString()} ${JSON.stringify(results)} (${Date.now() - started} ms)`);
}

void tick();
setInterval(tick, INTERVAL);
