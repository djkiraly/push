import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./data/push.db";

// Prisma 7+: connection URL lives here, not in schema.prisma.
// `datasource.url` is consumed by Prisma Migrate; the adapter is what the
// runtime PrismaClient (and Migrate, in this version) uses to actually
// talk to the SQLite file.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url,
  },
  // adapter is a Prisma 7 runtime feature; the public type lags behind the
  // runtime config — cast to silence the unknown-property error.
  adapter: async () => new PrismaBetterSqlite3({ url }),
} as Parameters<typeof defineConfig>[0]);
