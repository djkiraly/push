import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // setup-db.ts points DATABASE_URL at a throwaway SQLite file and applies
    // the real Prisma migration before any module (and thus the db singleton)
    // is imported.
    setupFiles: ["./test/setup-db.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
