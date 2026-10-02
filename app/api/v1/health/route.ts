import { handle, ok } from "@/src/lib/http";
import { getHealth } from "@/src/modules/health/service";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const health = await getHealth();
  return ok(health, { status: health.status === "ok" ? 200 : 503 });
});
