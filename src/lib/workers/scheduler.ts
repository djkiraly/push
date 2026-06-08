import { prisma } from "@/lib/db";
import { dispatch } from "@/lib/platforms/publisher";
import { child } from "../logger";

const log = child({ worker: "scheduler" });

const TICK_MS = 30_000;
const CLAIM_BATCH = 5;

// After 3 failed attempts we mark FAILED. Backoffs are between attempt N and
// attempt N+1, so BACKOFFS_MS[0] = wait between first and second attempt.
const MAX_ATTEMPTS = 3;
const BACKOFFS_MS = [5 * 60_000, 30 * 60_000, 2 * 3_600_000];

let timer: NodeJS.Timeout | null = null;
let running = false;
let stopping = false;

async function claimDue(): Promise<string[]> {
  // Single-process SQLite, but we still do this transactionally to make the
  // claim explicit. updateMany returns a count; we trust ours is the only
  // writer.
  return prisma.$transaction(async (tx) => {
    const due = await tx.platformPost.findMany({
      where: {
        status: "SCHEDULED",
        lockedAt: null,
        scheduledFor: { lte: new Date() },
      },
      take: CLAIM_BATCH,
      orderBy: { scheduledFor: "asc" },
      select: { id: true },
    });
    if (due.length === 0) return [];
    await tx.platformPost.updateMany({
      where: { id: { in: due.map((p) => p.id) }, lockedAt: null },
      data: { status: "PUBLISHING", lockedAt: new Date() },
    });
    return due.map((p) => p.id);
  });
}

async function recordSuccess(
  id: string,
  externalPostId: string,
  externalPermalink: string | null,
): Promise<void> {
  await prisma.platformPost.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      externalPostId,
      externalPermalink,
      publishedAt: new Date(),
      lockedAt: null,
      lastError: null,
    },
  });
  await prisma.platformPostEvent.create({
    data: {
      platformPostId: id,
      eventType: "PUBLISHED",
      payload: { externalPostId, externalPermalink: externalPermalink ?? null },
    },
  });
}

async function recordFailure(
  id: string,
  error: string,
  transient: boolean,
): Promise<void> {
  const current = await prisma.platformPost.findUnique({
    where: { id },
    select: { attempts: true },
  });
  const attempts = (current?.attempts ?? 0) + 1;

  // Permanent error or out of retries → FAILED.
  if (!transient || attempts >= MAX_ATTEMPTS) {
    await prisma.platformPost.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts,
        lockedAt: null,
        lastError: error,
      },
    });
    await prisma.platformPostEvent.create({
      data: {
        platformPostId: id,
        eventType: "FAILED",
        payload: { error, attempts, transient },
      },
    });
    return;
  }

  // Retry: reschedule with backoff.
  const backoff = BACKOFFS_MS[attempts - 1] ?? BACKOFFS_MS[BACKOFFS_MS.length - 1] ?? 30 * 60_000;
  const nextAttempt = new Date(Date.now() + backoff);
  await prisma.platformPost.update({
    where: { id },
    data: {
      status: "SCHEDULED",
      attempts,
      lockedAt: null,
      lastError: error,
      scheduledFor: nextAttempt,
    },
  });
  await prisma.platformPostEvent.create({
    data: {
      platformPostId: id,
      eventType: "RETRY_SCHEDULED",
      payload: { error, attempts, retryAt: nextAttempt.toISOString() },
    },
  });
}

async function processOne(id: string): Promise<void> {
  try {
    const result = await dispatch(id);
    if (result.ok) {
      log.info(
        { id, externalPostId: result.externalPostId },
        "platform post published",
      );
      await recordSuccess(id, result.externalPostId, result.externalPermalink);
    } else {
      log.warn({ id, error: result.error, transient: result.transient }, "publish failed");
      await recordFailure(id, result.error, result.transient);
    }
  } catch (err) {
    // Defensive — dispatch already catches, but persist anything that escapes.
    log.error({ err, id }, "processOne crashed");
    await recordFailure(
      id,
      err instanceof Error ? err.message : String(err),
      false,
    ).catch(() => {});
  }
}

async function tick(): Promise<void> {
  if (running || stopping) return;
  running = true;
  try {
    const ids = await claimDue();
    if (ids.length === 0) return;
    log.info({ count: ids.length }, "claimed due posts");
    // Run claimed posts concurrently — independent platforms, no shared state.
    await Promise.all(ids.map(processOne));
  } catch (err) {
    log.error({ err }, "scheduler tick failed");
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (timer) return;
  stopping = false;
  log.info({ tickMs: TICK_MS }, "scheduler started");
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  void tick();
}

export async function stopScheduler(): Promise<void> {
  if (!timer) return;
  stopping = true;
  clearInterval(timer);
  timer = null;
  // Allow any in-flight tick to drain.
  const deadline = Date.now() + 30_000;
  while (running && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  log.info("scheduler stopped");
}

// Test-only surface. These functions are the worker's internals; they are not
// part of its public API and must not be imported by application code. Exposed
// so the claim/lock and retry/backoff logic can be unit-tested directly.
export const _internal = {
  claimDue,
  recordSuccess,
  recordFailure,
  processOne,
  tick,
  MAX_ATTEMPTS,
  BACKOFFS_MS,
};

// Exposed so manual "publish now" actions can run a row immediately without
// waiting for the next tick.
export async function publishNow(platformPostId: string): Promise<void> {
  await prisma.platformPost.update({
    where: { id: platformPostId },
    data: { status: "PUBLISHING", lockedAt: new Date() },
  });
  await processOne(platformPostId);
}
