import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadedPlatformPost } from "@/lib/platforms/publish-context";

// Mock every IO boundary the IG publisher touches: the HTTP helpers, the token
// fetch, the media-URL/caption builders, and the logger. This exercises the
// container create → poll → publish orchestration in isolation.
const h = vi.hoisted(() => ({
  getJson: vi.fn(),
  postForm: vi.fn(),
  getValidMetaToken: vi.fn(),
}));
vi.mock("@/lib/platforms/http", () => ({ getJson: h.getJson, postForm: h.postForm }));
vi.mock("@/lib/platforms/meta/token", () => ({ getValidMetaToken: h.getValidMetaToken }));
vi.mock("@/lib/platforms/publish-context", () => ({
  composeText: (pp: { caption: string }) => pp.caption,
  publicMediaUrl: (id: string) => `https://push.test/api/media/${id}/file`,
}));
const noop = () => {};
vi.mock("@/lib/logger", () => ({
  child: () => ({ info: noop, warn: noop, error: noop, debug: noop }),
}));

const { publishInstagram } = await import("@/lib/platforms/instagram/publish");

const IG_USER = "ig-user-99";

// Sequential container ids so multi-container (carousel) flows get distinct ids.
let containerSeq = 0;
function buildPost(
  media: Array<{ id: string; mime: string }>,
  caption = "caption text",
): LoadedPlatformPost {
  return {
    id: "pp-1",
    accountId: "acct-1",
    caption,
    hashtags: null,
    account: { externalId: IG_USER },
    post: {
      media: media.map((m, i) => ({
        position: i,
        mediaAssetId: m.id,
        mediaAsset: { mimeType: m.mime },
      })),
    },
  } as unknown as LoadedPlatformPost;
}

// Helper: which params each container-create (POST .../media) call received.
function containerCalls(): Array<Record<string, string>> {
  return h.postForm.mock.calls
    .filter(([url]) => (url as string).endsWith("/media"))
    .map(([, form]) => form as Record<string, string>);
}
function publishCalls(): Array<Record<string, string>> {
  return h.postForm.mock.calls
    .filter(([url]) => (url as string).endsWith("/media_publish"))
    .map(([, form]) => form as Record<string, string>);
}

beforeEach(() => {
  containerSeq = 0;
  h.getJson.mockReset();
  h.postForm.mockReset();
  h.getValidMetaToken.mockReset();

  h.getValidMetaToken.mockResolvedValue("IG_TOKEN");

  // Default: every container creation succeeds with a fresh id; publish returns
  // a media id.
  h.postForm.mockImplementation(async (url: string) => {
    if (url.endsWith("/media_publish")) return { id: "published-media-id" };
    if (url.endsWith("/media")) return { id: `container-${++containerSeq}` };
    throw new Error(`unexpected postForm: ${url}`);
  });

  // Default: status polls report FINISHED immediately; permalink resolves.
  h.getJson.mockImplementation(async (url: string) => {
    if (url.includes("permalink")) return { permalink: "https://instagram.com/p/abc" };
    if (url.includes("status_code")) return { status_code: "FINISHED" };
    throw new Error(`unexpected getJson: ${url}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("publishInstagram — single image", () => {
  it("creates an image container, polls, publishes, and returns the media id + permalink", async () => {
    const result = await publishInstagram(buildPost([{ id: "img1", mime: "image/jpeg" }]));

    expect(result).toEqual({
      externalPostId: "published-media-id",
      externalPermalink: "https://instagram.com/p/abc",
    });

    const containers = containerCalls();
    expect(containers).toHaveLength(1);
    expect(containers[0]).toMatchObject({
      image_url: "https://push.test/api/media/img1/file",
      caption: "caption text",
      access_token: "IG_TOKEN",
    });
    // A single image must NOT declare a media_type (that's for reels/carousel).
    expect(containers[0]).not.toHaveProperty("media_type");

    // Published against the container we created.
    expect(publishCalls()[0]).toMatchObject({ creation_id: "container-1" });
  });

  it("still succeeds (permalink null) when the permalink fetch fails", async () => {
    h.getJson.mockImplementation(async (url: string) => {
      if (url.includes("permalink")) throw new Error("403");
      return { status_code: "FINISHED" };
    });

    const result = await publishInstagram(buildPost([{ id: "img1", mime: "image/jpeg" }]));
    expect(result.externalPostId).toBe("published-media-id");
    expect(result.externalPermalink).toBeNull();
  });
});

describe("publishInstagram — reel (single video)", () => {
  it("creates a REELS container with video_url and share_to_feed", async () => {
    await publishInstagram(buildPost([{ id: "vid1", mime: "video/mp4" }]));

    const containers = containerCalls();
    expect(containers).toHaveLength(1);
    expect(containers[0]).toMatchObject({
      media_type: "REELS",
      video_url: "https://push.test/api/media/vid1/file",
      share_to_feed: "true",
    });
  });
});

describe("publishInstagram — carousel", () => {
  it("creates one is_carousel_item child per asset, then a CAROUSEL parent", async () => {
    await publishInstagram(
      buildPost([
        { id: "img1", mime: "image/jpeg" },
        { id: "img2", mime: "image/png" },
      ]),
    );

    const containers = containerCalls();
    // 2 children + 1 parent.
    expect(containers).toHaveLength(3);
    expect(containers[0]).toMatchObject({ is_carousel_item: "true", image_url: expect.stringContaining("img1") });
    expect(containers[1]).toMatchObject({ is_carousel_item: "true", image_url: expect.stringContaining("img2") });
    expect(containers[2]).toMatchObject({
      media_type: "CAROUSEL",
      children: "container-1,container-2",
      caption: "caption text",
    });

    expect(publishCalls()[0]).toMatchObject({ creation_id: "container-3" });
  });

  it("rejects a carousel with more than 10 items", async () => {
    const media = Array.from({ length: 11 }, (_, i) => ({ id: `i${i}`, mime: "image/jpeg" }));
    await expect(publishInstagram(buildPost(media))).rejects.toThrow(/2–10 items/);
  });
});

describe("publishInstagram — container status polling", () => {
  it("waits through IN_PROGRESS until FINISHED before publishing", async () => {
    vi.useFakeTimers();
    let statusPolls = 0;
    h.getJson.mockImplementation(async (url: string) => {
      if (url.includes("permalink")) return { permalink: null };
      if (url.includes("status_code")) {
        statusPolls += 1;
        return { status_code: statusPolls === 1 ? "IN_PROGRESS" : "FINISHED" };
      }
      throw new Error(`unexpected getJson: ${url}`);
    });

    const p = publishInstagram(buildPost([{ id: "vid1", mime: "video/mp4" }]));
    // Advance past one 3s poll interval so the second poll (FINISHED) runs.
    await vi.advanceTimersByTimeAsync(3500);
    const result = await p;

    expect(statusPolls).toBe(2);
    expect(result.externalPostId).toBe("published-media-id");
    expect(publishCalls()).toHaveLength(1);
  });

  it("throws and never publishes when the container reports ERROR", async () => {
    h.getJson.mockImplementation(async (url: string) => {
      if (url.includes("status_code")) return { status_code: "ERROR", status: "media download failed" };
      return { permalink: null };
    });

    await expect(
      publishInstagram(buildPost([{ id: "img1", mime: "image/jpeg" }])),
    ).rejects.toThrow(/IG container ERROR: media download failed/);
    expect(publishCalls()).toHaveLength(0);
  });

  it("times out after the 5-minute polling window", async () => {
    vi.useFakeTimers();
    h.getJson.mockImplementation(async (url: string) => {
      if (url.includes("status_code")) return { status_code: "IN_PROGRESS" };
      return { permalink: null };
    });

    const settled = publishInstagram(buildPost([{ id: "img1", mime: "image/jpeg" }])).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 4000);
    const err = await settled;

    expect(String(err)).toMatch(/timed out/);
    expect(publishCalls()).toHaveLength(0);
  });
});
