import { prisma } from "@/lib/db";
import { snapshotPlatformPost } from "@/lib/analytics";
import { child } from "../logger";

const log = child({ worker: "analytics-poller" });

const TICK_MS = 60 * 60_000; // hourly
const LOOKBACK_DAYS = 30;
const MIN_SNAPSHOT_AGE_MS = 55 * 60_000; // skip if last snapshot <55 min old

let timer: NodeJS.Timeout | null = null;
let running = false;

async function eligiblePosts(): Promise<string[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60_000);
  const cutoff = new Date(Date.now() - MIN_SNAPSHOT_AGE_MS);
  const rows = await prisma.platformPost.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: since },
      externalPostId: { not: null },
    },
    select: {
      id: true,
      metrics: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: { capturedAt: true },
      },
    },
  });
  return rows
    .filter((r) => {
      const last = r.metrics[0]?.capturedAt;
      return !last || last < cutoff;
    })
    .map((r) => r.id);
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const ids = await eligiblePosts();
    if (ids.length === 0) return;
    log.info({ count: ids.length }, "polling metrics");
    // Sequential to avoid burst rate-limits across platforms.
    for (const id of ids) {
      const result = await snapshotPlatformPost(id);
      if (!result.ok && result.permanent) {
        log.warn({ id, error: result.error }, "permanent snapshot failure");
      }
    }
  } catch (err) {
    log.error({ err }, "analytics tick failed");
  } finally {
    running = false;
  }
}

export function startAnalyticsPoller(): void {
  if (timer) return;
  log.info({ tickMs: TICK_MS }, "analytics-poller started");
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // Delay first tick so server boot finishes first.
  setTimeout(() => {
    void tick();
  }, 30_000).unref();
}

export function stopAnalyticsPoller(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  log.info("analytics-poller stopped");
}

// Allow a "refresh now" button to trigger a poll without waiting an hour.
export async function pollAnalyticsOnce(): Promise<{ polled: number }> {
  const ids = await eligiblePosts();
  for (const id of ids) {
    await snapshotPlatformPost(id);
  }
  return { polled: ids.length };
}
