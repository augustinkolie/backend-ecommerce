import { handle, ok, parseQuery } from "@/src/lib/http";
import type { Ctx } from "@/src/lib/params";
import { productListQuery } from "@/src/modules/catalog/schema";
import { getCollection, listProducts } from "@/src/modules/catalog/service";

export const GET = handle(async (req, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  const collection = await getCollection(slug);
  const products = await listProducts({ ...parseQuery(req, productListQuery), collection: slug });
  return ok({ collection, ...products });
});
