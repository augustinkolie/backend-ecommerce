import { env } from "@/src/lib/env";
import { AppError } from "@/src/lib/errors";
import { handle, ok } from "@/src/lib/http";
import { runAll } from "@/src/jobs";

/** Déclenchement des tâches planifiées par un cron externe. */
export const POST = handle(async (req) => {
  const secret = env().JOBS_SECRET;
  if (!secret || req.headers.get("x-jobs-secret") !== secret) throw AppError.unauthorized();
  return ok(await runAll());
});
