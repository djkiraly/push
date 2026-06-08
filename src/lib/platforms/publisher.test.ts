import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the publish-context loader and every platform publisher so importing
// the dispatcher never reaches real HTTP/undici/sharp code paths.
const h = vi.hoisted(() => ({
  loadPlatformPost: vi.fn(),
  publishFacebook: vi.fn(),
  publishInstagram: vi.fn(),
  publishTikTok: vi.fn(),
  publishYouTube: vi.fn(),
}));
vi.mock("@/lib/platforms/publish-context", () => ({ loadPlatformPost: h.loadPlatformPost }));
vi.mock("@/lib/platforms/facebook/publish", () => ({ publishFacebook: h.publishFacebook }));
vi.mock("@/lib/platforms/instagram/publish", () => ({ publishInstagram: h.publishInstagram }));
vi.mock("@/lib/platforms/tiktok/publish", () => ({ publishTikTok: h.publishTikTok }));
vi.mock("@/lib/platforms/youtube/publish", () => ({ publishYouTube: h.publishYouTube }));

const { classify, dispatch } = await import("@/lib/platforms/publisher");

describe("classify", () => {
  it.each([
    "ECONNRESET",
    "socket hang up ETIMEDOUT",
    "getaddrinfo ENOTFOUND graph.facebook.com",
    "EAI_AGAIN",
    "Rate limit exceeded",
    "rate-limit reached",
    "Request timeout after 30s",
    "Server busy, please try again later",
    "Server responded 503",
    "Internal error 500",
  ])("treats %j as transient", (msg) => {
    expect(classify(new Error(msg)).transient).toBe(true);
  });

  it.each([
    "Invalid caption",
    "Permission denied",
    "Unsupported media type",
    "OAuthException: token expired",
  ])("treats %j as permanent", (msg) => {
    expect(classify(new Error(msg)).transient).toBe(false);
  });

  it("extracts the message from an Error", () => {
    expect(classify(new Error("kaboom")).message).toBe("kaboom");
  });

  it("passes through a string error", () => {
    expect(classify("plain string")).toEqual({ transient: false, message: "plain string" });
  });

  it("falls back to 'unknown error' for non-error, non-string values", () => {
    expect(classify({ weird: true }).message).toBe("unknown error");
    expect(classify(null).message).toBe("unknown error");
  });
});

describe("dispatch", () => {
  beforeEach(() => {
    for (const fn of Object.values(h)) fn.mockReset();
  });

  it("returns a permanent failure when the PlatformPost is missing", async () => {
    h.loadPlatformPost.mockResolvedValueOnce(null);
    const result = await dispatch("missing-id");
    expect(result).toEqual({ ok: false, error: "PlatformPost not found", transient: false });
  });

  it("routes to the correct platform publisher and returns its ids", async () => {
    h.loadPlatformPost.mockResolvedValueOnce({ platform: "FACEBOOK" });
    h.publishFacebook.mockResolvedValueOnce({
      externalPostId: "fb-1",
      externalPermalink: "https://fb.com/fb-1",
    });

    const result = await dispatch("pp-1");

    expect(h.publishFacebook).toHaveBeenCalledOnce();
    expect(h.publishInstagram).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      externalPostId: "fb-1",
      externalPermalink: "https://fb.com/fb-1",
    });
  });

  it("classifies a thrown transient error from the publisher", async () => {
    h.loadPlatformPost.mockResolvedValueOnce({ platform: "INSTAGRAM" });
    h.publishInstagram.mockRejectedValueOnce(new Error("ETIMEDOUT polling container"));

    const result = await dispatch("pp-2");

    expect(result).toEqual({ ok: false, error: "ETIMEDOUT polling container", transient: true });
  });

  it("classifies a thrown permanent error from the publisher", async () => {
    h.loadPlatformPost.mockResolvedValueOnce({ platform: "YOUTUBE" });
    h.publishYouTube.mockRejectedValueOnce(new Error("invalid video format"));

    const result = await dispatch("pp-3");

    expect(result).toEqual({ ok: false, error: "invalid video format", transient: false });
  });
});
