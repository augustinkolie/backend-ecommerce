import { pingDatabase } from "./repository";

export async function getHealth() {
  const database = await pingDatabase().then(
    () => "up" as const,
    () => "down" as const,
  );
  return { status: database === "up" ? "ok" : "degraded", database, time: new Date().toISOString() };
}
