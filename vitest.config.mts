import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    // Variables de .env (DATABASE_URL…) pour les tests d'intégration.
    setupFiles: ["dotenv/config"],
    // Les tests d'intégration partagent la base : exécution séquentielle.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
