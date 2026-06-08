import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DispatchResult } from "@/lib/platforms/publisher";
import {
  createPlatformPost,
  eventTypes,
  getPlatformPost,
  resetDb,
  seedParents,
  type Parents,
} from "../../../test/db";

// Silence the pino logger (avoids spawning a pretty-print transport worker).
const noop = () => {};
vi.mock("@/lib/logger", () => {
  const stub = { info: noop, warn: noop, error: noop, debug: noop, fatal: noop, trace: noop };
  return { child: () => stub, logger: { ...stub, child: () => stub } };
});

// Mock the publisher so the scheduler's claim/retry logic is exercised in
// isolation from the actual platform HTTP calls.
const { dispatchMock } = vi.hoisted(() => ({ dispatchMock: vi.fn() }));
vi.mock("@/lib/platforms/publisher", () => ({ dispatch: dispatchMock }));

// Import after mocks are registered.
const { _internal } = await import("@/lib/workers/scheduler");

const ok = (externalPostId: string, permalink: string | null = null): DispatchResult => ({
  ok: true,
  externalPostId,
  externalPermalink: permalink,
});
const fail = (error: string, transient: boolean): DispatchResult => ({ ok: false, error, transient });

let parents: Parents;

beforeEach(async () => {
  await resetDb();
  dispatchMock.mockReset();
  parents = await seedParents();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("claimDue", () => {
  it("claims only SCHEDULED, due, unlocked rows and flips them to PUBLISHING", async () => {
    const due = await createPlatformPost(parents);
    const future = await createPlatformPost(parents, {
      scheduledFor: new Date(Date.now() + 60 * 60_000),
    });
    const locked = await createPlatformPost(parents, { lockedAt: new Date() });
    const draft = await createPlatformPost(parents, { status: "DRAFT" });
    const published = await createPlatformPost(parents, { status: "PUBLISHED" });

    const claimed = await _internal.claimDue();

    expect(claimed).toEqual([due.id]);

    expect((await getPlatformPost(due.id))?.status).toBe("PUBLISHING");
    expect((await getPlatformPost(due.id))?.lockedAt).not.toBeNull();

    // Everything else is untouched.
    expect((await getPlatformPost(future.id))?.status).toBe("SCHEDULED");
    expect((await getPlatformPost(future.id))?.lockedAt).toBeNull();
    expect((await getPlatformPost(locked.id))?.status).toBe("SCHEDULED");
    expect((await getPlatformPost(draft.id))?.status).toBe("DRAFT");
    expect((await getPlatformPost(published.id))?.status).toBe("PUBLISHED");
  });

  it("claims at most CLAIM_BATCH (5) rows per call", async () => {
    for (let i = 0; i < 6; i++) {
      await createPlatformPost(parents, {
        scheduledFor: new Date(Date.now() - (i + 1) * 1000),
      });
    }
    const claimed = await _internal.claimDue();
    expect(claimed).toHaveLength(5);

    const stillScheduled = await import("@/lib/db").then((m) =>
      m.prisma.platformPost.count({ where: { status: "SCHEDULED", lockedAt: null } }),
    );
    expect(stillScheduled).toBe(1);
  });

  it("claims oldest-scheduled rows first", async () => {
    const base = Date.now();
    const rows = [];
    for (let i = 0; i < 6; i++) {
      rows.push(
        await createPlatformPost(parents, {
          // i=0 oldest ... i=5 newest
          scheduledFor: new Date(base - (6 - i) * 60_000),
        }),
      );
    }
    const claimed = await _internal.claimDue();
    // The newest (last) row is the one left behind.
    expect(claimed).not.toContain(rows[5]!.id);
    expect(claimed).toContain(rows[0]!.id);
    expect((await getPlatformPost(rows[5]!.id))?.status).toBe("SCHEDULED");
  });
});

describe("recordSuccess", () => {
  it("marks PUBLISHED, stores external ids, clears the lock, logs an event", async () => {
    const pp = await createPlatformPost(parents, { status: "PUBLISHING", lockedAt: new Date() });

    await _internal.recordSuccess(pp.id, "ext-123", "https://fb.com/p/123");

    const row = await getPlatformPost(pp.id);
    expect(row?.status).toBe("PUBLISHED");
    expect(row?.externalPostId).toBe("ext-123");
    expect(row?.externalPermalink).toBe("https://fb.com/p/123");
    expect(row?.publishedAt).not.toBeNull();
    expect(row?.lockedAt).toBeNull();
    expect(row?.lastError).toBeNull();
    expect(await eventTypes(pp.id)).toEqual(["PUBLISHED"]);
  });
});

describe("recordFailure — retry/backoff", () => {
  it("reschedules with a 5-minute backoff on the first transient failure", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-06-08T12:00:00.000Z");
    vi.setSystemTime(now);

    const pp = await createPlatformPost(parents, {
      status: "PUBLISHING",
      attempts: 0,
      lockedAt: new Date(),
    });

    await _internal.recordFailure(pp.id, "ECONNRESET", true);

    const row = await getPlatformPost(pp.id);
    expect(row?.status).toBe("SCHEDULED");
    expect(row?.attempts).toBe(1);
    expect(row?.lockedAt).toBeNull();
    expect(row?.lastError).toBe("ECONNRESET");
    expect(row?.scheduledFor?.getTime()).toBe(now.getTime() + 5 * 60_000);
    expect(await eventTypes(pp.id)).toEqual(["RETRY_SCHEDULED"]);
  });

  it("uses a 30-minute backoff on the second transient failure", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-06-08T12:00:00.000Z");
    vi.setSystemTime(now);

    const pp = await createPlatformPost(parents, { status: "PUBLISHING", attempts: 1 });
    await _internal.recordFailure(pp.id, "timeout", true);

    const row = await getPlatformPost(pp.id);
    expect(row?.status).toBe("SCHEDULED");
    expect(row?.attempts).toBe(2);
    expect(row?.scheduledFor?.getTime()).toBe(now.getTime() + 30 * 60_000);
  });

  it("marks FAILED after the third (max) attempt", async () => {
    const pp = await createPlatformPost(parents, { status: "PUBLISHING", attempts: 2 });
    await _internal.recordFailure(pp.id, "still failing", true);

    const row = await getPlatformPost(pp.id);
    expect(row?.status).toBe("FAILED");
    expect(row?.attempts).toBe(3);
    expect(row?.lockedAt).toBeNull();
    expect(await eventTypes(pp.id)).toEqual(["FAILED"]);
  });

  it("marks FAILED immediately on a permanent (non-transient) error", async () => {
    const pp = await createPlatformPost(parents, { status: "PUBLISHING", attempts: 0 });
    await _internal.recordFailure(pp.id, "invalid caption", false);

    const row = await getPlatformPost(pp.id);
    expect(row?.status).toBe("FAILED");
    expect(row?.attempts).toBe(1);
    expect(await eventTypes(pp.id)).toEqual(["FAILED"]);
  });
});

describe("processOne", () => {
  it("publishes on a successful dispatch", async () => {
    const pp = await createPlatformPost(parents, { status: "PUBLISHING", lockedAt: new Date() });
    dispatchMock.mockResolvedValueOnce(ok("ext-9"));

    await _internal.processOne(pp.id);

    expect(dispatchMock).toHaveBeenCalledWith(pp.id);
    expect((await getPlatformPost(pp.id))?.status).toBe("PUBLISHED");
  });

  it("reschedules on a transient dispatch failure", async () => {
    const pp = await createPlatformPost(parents, { status: "PUBLISHING", attempts: 0 });
    dispatchMock.mockResolvedValueOnce(fail("rate limit hit", true));

    await _internal.processOne(pp.id);

    const row = await getPlatformPost(pp.id);
    expect(row?.status).toBe("SCHEDULED");
    expect(row?.attempts).toBe(1);
  });

  it("marks FAILED (non-transient) when dispatch throws unexpectedly", async () => {
    const pp = await createPlatformPost(parents, { status: "PUBLISHING", attempts: 0 });
    dispatchMock.mockRejectedValueOnce(new Error("boom"));

    await _internal.processOne(pp.id);

    const row = await getPlatformPost(pp.id);
    expect(row?.status).toBe("FAILED");
    expect(row?.attempts).toBe(1);
  });
});

describe("tick", () => {
  it("claims and publishes all due rows in one pass", async () => {
    const a = await createPlatformPost(parents);
    const b = await createPlatformPost(parents);
    dispatchMock.mockImplementation(async (id: string) => ok(`ext-${id}`));

    await _internal.tick();

    expect((await getPlatformPost(a.id))?.status).toBe("PUBLISHED");
    expect((await getPlatformPost(b.id))?.status).toBe("PUBLISHED");
    expect(dispatchMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no rows are due", async () => {
    await createPlatformPost(parents, { scheduledFor: new Date(Date.now() + 3_600_000) });
    await _internal.tick();
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
