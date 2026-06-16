// Vitest global setup — runs once in the main process, before any worker
// starts and again after the whole run finishes. The main process never opens
// these SQLite files, so unlink succeeds even on Windows (unlike the per-worker
// exit hook, where better-sqlite3 still holds the handle).
import { readdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");

function sweepTestDbs(): void {
  let names: string[];
  try {
    names = readdirSync(dataDir);
  } catch {
    return; // data/ not present yet — nothing to sweep.
  }
  for (const name of names) {
    if (/^test-\d+\.db(-wal|-shm)?$/.test(name)) {
      try {
        unlinkSync(path.join(dataDir, name));
      } catch {
        // a still-running worker may hold the handle — ignore; the next run
        // (or the teardown below) reclaims it.
      }
    }
  }
}

export default function setup() {
  // Clear leftovers from a prior run (e.g. a process killed mid-test).
  sweepTestDbs();
  // Teardown: clear this run's throwaway DBs after all workers have exited.
  return () => sweepTestDbs();
}
