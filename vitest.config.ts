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
    // global-setup.ts sweeps leftover test-*.db files before the run and after
    // teardown, from the main process (no open handles → unlink works on Win).
    globalSetup: ["./test/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
