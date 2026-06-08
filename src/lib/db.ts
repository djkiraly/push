import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

declare global {
  // eslint-disable-next-line no-var
  var __pushPrisma: PrismaClient | undefined;
}

function create(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./data/push.db",
  });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalThis.__pushPrisma ?? (globalThis.__pushPrisma = create());

if (process.env.NODE_ENV !== "production") {
  globalThis.__pushPrisma = prisma;
}
