import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Token helpers encrypt/decrypt against the real crypto module, so a valid key
// must be present before any import that pulls crypto in (accounts.ts).
process.env.PUSH_MASTER_KEY = "b2".repeat(32); // 64 hex chars

// The TikTok refresh path calls refreshToken() from ./oauth — mock it so no
// real HTTP happens and we can assert the persisted result.
const { refreshTokenMock } = vi.hoisted(() => ({ refreshTokenMock: vi.fn() }));
vi.mock("@/lib/platforms/tiktok/oauth", () => ({ refreshToken: refreshTokenMock }));

const { prisma } = await import("@/lib/db");
const { encrypt, decrypt } = await import("@/lib/crypto");
const { getValidMetaToken } = await import("@/lib/platforms/meta/token");
const { getValidTikTokToken } = await import("@/lib/platforms/tiktok/token");
const { resetDb } = await import("../../../test/db");

const HOUR = 60 * 60 * 1000;

beforeEach(async () => {
  await resetDb();
  refreshTokenMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

async function createTikTok(opts: {
  expiresAt: Date | null;
  refresh?: boolean;
  enabled?: boolean;
}) {
  return prisma.account.create({
    data: {
      platform: "TIKTOK",
      externalId: "tt-open-id",
      displayName: "TT",
      accessToken: encrypt("access-old"),
      refreshToken: opts.refresh ? encrypt("refresh-old") : null,
      tokenExpiresAt: opts.expiresAt,
      enabled: opts.enabled ?? true,
    },
  });
}

async function createMeta(opts: { enabled?: boolean } = {}) {
  return prisma.account.create({
    data: {
      platform: "FACEBOOK",
      externalId: "fb-page",
      displayName: "Page",
      accessToken: encrypt("page-token"),
      enabled: opts.enabled ?? true,
    },
  });
}

describe("getValidMetaToken", () => {
  it("returns the decrypted token without refreshing", async () => {
    const acct = await createMeta();
    expect(await getValidMetaToken(acct.id)).toBe("page-token");
  });

  it("throws when the account is missing", async () => {
    await expect(getValidMetaToken("nope")).rejects.toThrow(/not found/);
  });

  it("throws when the account is disabled", async () => {
    const acct = await createMeta({ enabled: false });
    await expect(getValidMetaToken(acct.id)).rejects.toThrow(/disabled/);
  });
});

describe("getValidTikTokToken", () => {
  it("returns the current token when comfortably before expiry (no refresh)", async () => {
    const acct = await createTikTok({
      expiresAt: new Date(Date.now() + HOUR),
      refresh: true,
    });

    expect(await getValidTikTokToken(acct.id)).toBe("access-old");
    expect(refreshTokenMock).not.toHaveBeenCalled();
  });

  it("refreshes, persists new ciphertext, and returns the new token near expiry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-06-12T00:00:00.000Z");
    vi.setSystemTime(now);

    const acct = await createTikTok({
      // 1 minute left — inside the 5-minute leeway.
      expiresAt: new Date(now.getTime() + 60_000),
      refresh: true,
    });

    refreshTokenMock.mockResolvedValueOnce({
      access_token: "access-new",
      refresh_token: "refresh-new",
      expires_in: 7200,
      open_id: "tt-open-id",
      scope: "user.info.basic,video.publish",
      token_type: "Bearer",
    });

    const token = await getValidTikTokToken(acct.id);

    expect(token).toBe("access-new");
    // refreshToken() was handed the decrypted refresh token, not the ciphertext.
    expect(refreshTokenMock).toHaveBeenCalledWith("refresh-old");

    // The new tokens are persisted encrypted, and the expiry advanced.
    const row = await prisma.account.findUniqueOrThrow({ where: { id: acct.id } });
    expect(decrypt(row.accessToken)).toBe("access-new");
    expect(decrypt(row.refreshToken!)).toBe("refresh-new");
    expect(row.tokenExpiresAt?.getTime()).toBe(now.getTime() + 7200 * 1000);
    expect(row.scopes).toBe("user.info.basic,video.publish");
  });

  it("treats a missing expiry as already-expired and refreshes", async () => {
    const acct = await createTikTok({ expiresAt: null, refresh: true });
    refreshTokenMock.mockResolvedValueOnce({
      access_token: "access-new",
      refresh_token: "refresh-new",
      expires_in: 7200,
      open_id: "tt-open-id",
      scope: "video.publish",
      token_type: "Bearer",
    });

    expect(await getValidTikTokToken(acct.id)).toBe("access-new");
    expect(refreshTokenMock).toHaveBeenCalledOnce();
  });

  it("throws (telling the operator to reconnect) when near expiry with no refresh token", async () => {
    const acct = await createTikTok({
      expiresAt: new Date(Date.now() + 60_000),
      refresh: false,
    });
    await expect(getValidTikTokToken(acct.id)).rejects.toThrow(/reconnect/);
    expect(refreshTokenMock).not.toHaveBeenCalled();
  });

  it("throws when the account is missing", async () => {
    await expect(getValidTikTokToken("nope")).rejects.toThrow(/not found/);
  });

  it("throws when the account is disabled", async () => {
    const acct = await createTikTok({
      expiresAt: new Date(Date.now() + HOUR),
      enabled: false,
    });
    await expect(getValidTikTokToken(acct.id)).rejects.toThrow(/disabled/);
  });
});
