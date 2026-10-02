import { handle, ok } from "@/src/lib/http";
import { categoryTree } from "@/src/modules/catalog/service";

export const GET = handle(async () => ok((await categoryTree()).roots));
