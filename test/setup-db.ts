// Vitest setup file — runs before each test file's modules are imported.
//
// Push is a real-SQLite app (single-process, no mocking the DB layer), so the
// scheduler tests run against a genuine throwaway SQLite database created from
// the project's actual Prisma migration. We deliberately do NOT mock Prisma:
// the claim/lock logic is a transactional SELECT+UPDATE and is only meaningful
// against a real engine.
import Database from "better-sqlite3";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

// One file per worker process so parallel test files never share a DB.
const dbPath = path.resolve(process.cwd(), "data", `test-${process.pid}.db`);

// db.ts reads DATABASE_URL at construction time; set it before any import of
// the Prisma singleton (setupFiles run before the test module is evaluated).
process.env.DATABASE_URL = `file:${dbPath}`;
// NODE_ENV is typed read-only by Next's env augmentation; assign through a cast.
if (!process.env.NODE_ENV) (process.env as { NODE_ENV?: string }).NODE_ENV = "test";

const MIGRATION = path.resolve(
  process.cwd(),
  "prisma",
  "migrations",
  "20260508163722_init",
  "migration.sql",
);

// Make the migration idempotent so re-applying it across files in a reused
// worker is a no-op rather than a "table already exists" error.
const ddl = readFileSync(MIGRATION, "utf8")
  .replace(/CREATE TABLE "/g, 'CREATE TABLE IF NOT EXISTS "')
  .replace(/CREATE UNIQUE INDEX "/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
  .replace(/CREATE INDEX "/g, 'CREATE INDEX IF NOT EXISTS "');

const setup = new Database(dbPath);
setup.pragma("journal_mode = WAL");
setup.exec(ddl);
setup.close();

// Best-effort cleanup of the throwaway files when the worker exits.
process.on("exit", () => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      unlinkSync(dbPath + suffix);
    } catch {
      // file may not exist or still be locked — ignore.
    }
  }
});
