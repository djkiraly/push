import { getJson, postForm } from "../http";
import { getValidMetaToken } from "../meta/token";
import {
  composeText,
  publicMediaUrl,
  type LoadedPlatformPost,
} from "../publish-context";
import { child } from "@/lib/logger";

const log = child({ module: "publisher/instagram" });
const GRAPH = "https://graph.facebook.com/v21.0";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 5 * 60 * 1000;

type ContainerResponse = { id: string };
type StatusResponse = {
  status_code: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
  status?: string;
};
type PublishResponse = { id: string };

export type PublishResult = {
  externalPostId: string;
  externalPermalink: string | null;
};

async function createContainer(
  igUserId: string,
  token: string,
  params: Record<string, string>,
): Promise<string> {
  const res = await postForm<ContainerResponse>(
    `${GRAPH}/${igUserId}/media`,
    { ...params, access_token: token },
  );
  return res.id;
}

async function waitForContainerReady(
  containerId: string,
  token: string,
): Promise<void> {
  const deadline = Date.now() + MAX_POLL_MS;
  while (Date.now() < deadline) {
    const res = await getJson<StatusResponse>(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    if (res.status_code === "FINISHED" || res.status_code === "PUBLISHED") return;
    if (res.status_code === "ERROR" || res.status_code === "EXPIRED") {
      throw new Error(`IG container ${res.status_code}: ${res.status ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("IG container polling timed out (>5min)");
}

async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<string> {
  const res = await postForm<PublishResponse>(
    `${GRAPH}/${igUserId}/media_publish`,
    { creation_id: containerId, access_token: token },
  );
  return res.id;
}

async function fetchPermalink(mediaId: string, token: string): Promise<string | null> {
  try {
    const res = await getJson<{ permalink?: string }>(
      `${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`,
    );
    return res.permalink ?? null;
  } catch (err) {
    log.warn({ err, mediaId }, "permalink fetch failed (non-fatal)");
    return null;
  }
}

async function publishSingleImage(pp: LoadedPlatformPost, token: string): Promise<PublishResult> {
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");
  const containerId = await createContainer(pp.account.externalId, token, {
    image_url: publicMediaUrl(first.mediaAssetId),
    caption: composeText(pp),
  });
  await waitForContainerReady(containerId, token);
  const mediaId = await publishContainer(pp.account.externalId, token, containerId);
  return { externalPostId: mediaId, externalPermalink: await fetchPermalink(mediaId, token) };
}

async function publishReel(pp: LoadedPlatformPost, token: string): Promise<PublishResult> {
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");
  const containerId = await createContainer(pp.account.externalId, token, {
    media_type: "REELS",
    video_url: publicMediaUrl(first.mediaAssetId),
    caption: composeText(pp),
    share_to_feed: "true",
  });
  await waitForContainerReady(containerId, token);
  const mediaId = await publishContainer(pp.account.externalId, token, containerId);
  return { externalPostId: mediaId, externalPermalink: await fetchPermalink(mediaId, token) };
}

async function publishCarousel(pp: LoadedPlatformPost, token: string): Promise<PublishResult> {
  if (pp.post.media.length < 2 || pp.post.media.length > 10) {
    throw new Error("IG carousel requires 2–10 items");
  }
  const childIds: string[] = [];
  for (const m of pp.post.media) {
    const isVideo = m.mediaAsset.mimeType.startsWith("video/");
    const params: Record<string, string> = {
      is_carousel_item: "true",
    };
    if (isVideo) {
      params.media_type = "VIDEO";
      params.video_url = publicMediaUrl(m.mediaAssetId);
    } else {
      params.image_url = publicMediaUrl(m.mediaAssetId);
    }
    const id = await createContainer(pp.account.externalId, token, params);
    if (isVideo) {
      await waitForContainerReady(id, token);
    }
    childIds.push(id);
  }
  const parentId = await createContainer(pp.account.externalId, token, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: composeText(pp),
  });
  await waitForContainerReady(parentId, token);
  const mediaId = await publishContainer(pp.account.externalId, token, parentId);
  return { externalPostId: mediaId, externalPermalink: await fetchPermalink(mediaId, token) };
}

export async function publishInstagram(pp: LoadedPlatformPost): Promise<PublishResult> {
  const token = await getValidMetaToken(pp.accountId);
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");

  if (pp.post.media.length > 1) {
    return publishCarousel(pp, token);
  }
  if (first.mediaAsset.mimeType.startsWith("video/")) {
    return publishReel(pp, token);
  }
  return publishSingleImage(pp, token);
}
