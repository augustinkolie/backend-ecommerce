import { configureIndex } from "@/src/lib/search";
import { syncProducts } from "@/src/modules/search/service";
import { handle, ok } from "@/src/lib/http";
import { requirePermission } from "@/src/lib/auth";

/** Réindexation complète Meilisearch. */
export const POST = handle(async (req) => {
  await requirePermission(req, "settings");
  await configureIndex();
  return ok({ indexed: await syncProducts() });
});
