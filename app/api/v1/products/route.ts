import { handle, ok, parseQuery } from "@/src/lib/http";
import { productListQuery } from "@/src/modules/catalog/schema";
import { listProducts } from "@/src/modules/catalog/service";

export const GET = handle(async (req) => ok(await listProducts(parseQuery(req, productListQuery))));
