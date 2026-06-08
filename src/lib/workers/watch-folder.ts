// Watch folder worker — observes ./media/watch/ for new files and ingests
// them into the MediaAsset table.

import path from "node:path";
import { stat } from "node:fs/promises";
import chokidar, { type FSWatcher } from "chokidar";
import { child } from "../logger";
import { getSetting, SettingKeys } from "../settings";
import { ensureMediaDirs, MediaDirs } from "../media/storage";
import { ingestFromPath } from "../media/ingest";

const log = child({ worker: "watch-folder" });

let watcher: FSWatcher | null = null;

// Track in-flight ingests so we don't double-process while a large file is
// still being written, and to make stop() wait for them.
const pending = new Set<string>();

async function isStable(filePath: string): Promise<boolean> {
  try {
    const a = await stat(filePath);
    await new Promise((r) => setTimeout(r, 750));
    const b = await stat(filePath);
    return a.size === b.size && a.size > 0;
  } catch {
    return false;
  }
}

async function handleAdd(filePath: string): Promise<void> {
  if (pending.has(filePath)) return;
  pending.add(filePath);
  try {
    // chokidar emits add as soon as the inode appears; wait until size stops
    // changing so we don't hash a half-written file.
    let stable = false;
    for (let i = 0; i < 8 && !stable; i++) {
      stable = await isStable(filePath);
    }
    if (!stable) {
      log.warn({ filePath }, "file never stabilized — skipping");
      return;
    }

    const moveProcessed =
      (await getSetting<boolean>(SettingKeys.watchFolderMoveProcessed)) ?? false;

    const result = await ingestFromPath(filePath, {
      source: "WATCH_FOLDER",
      originalFilename: path.basename(filePath),
      deleteSource: moveProcessed,
    });

    if (result.status === "skipped") {
      log.warn({ filePath, reason: result.reason }, "watch ingest skipped");
    } else {
      log.info(
        { filePath, status: result.status, id: result.asset.id },
        "watch ingest done",
      );
    }
  } catch (err) {
    log.error({ err, filePath }, "watch ingest failed");
  } finally {
    pending.delete(filePath);
  }
}

export async function startWatchFolder(): Promise<void> {
  if (watcher) return;

  const enabled =
    (await getSetting<boolean>(SettingKeys.watchFolderEnabled)) ?? true;
  if (!enabled) {
    log.info("watch folder disabled in settings — not starting");
    return;
  }

  await ensureMediaDirs();

  watcher = chokidar.watch(MediaDirs.watch, {
    ignored: (p) => path.basename(p).startsWith("."),
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 250 },
    depth: 0,
  });

  watcher.on("add", (filePath) => {
    void handleAdd(filePath);
  });
  watcher.on("error", (err) => {
    log.error({ err }, "watcher error");
  });
  log.info({ dir: MediaDirs.watch }, "watch-folder worker started");
}

export async function stopWatchFolder(): Promise<void> {
  if (!watcher) return;
  await watcher.close();
  watcher = null;
  // Give in-flight ingests a brief grace period.
  const deadline = Date.now() + 5000;
  while (pending.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  log.info("watch-folder worker stopped");
}
