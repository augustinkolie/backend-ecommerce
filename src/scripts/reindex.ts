import "dotenv/config";
import { configureIndex } from "@/src/lib/search";
import { syncProducts } from "@/src/modules/search/service";

async function main() {
  await configureIndex();
  console.log(`Meilisearch : ${await syncProducts()} produits indexés`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
