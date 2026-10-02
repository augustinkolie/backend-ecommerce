import { handle, ok } from "@/src/lib/http";
import { publicSettings } from "@/src/modules/content/service";

/** Paramètres publics : boutique, devise, zones de livraison, moyens de paiement actifs. */
export const GET = handle(async () => ok(await publicSettings()));
