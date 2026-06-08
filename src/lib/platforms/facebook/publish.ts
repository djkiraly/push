import { readFile } from "node:fs/promises";
import { postMultipart, getJson } from "../http";
import { getValidMetaToken } from "../meta/token";
import {
  assertImage,
  assertVideo,
  composeText,
  type LoadedPlatformPost,
} from "../publish-context";
import { child } from "@/lib/logger";

const log = child({ module: "publisher/facebook" });

const GRAPH = "https://graph.facebook.com/v21.0";
const GRAPH_VIDEO = "https://graph-video.facebook.com/v21.0";

export type PublishResult = {
  externalPostId: string;
  externalPermalink: string | null;
};

async function readAsBlob(filePath: string, mimeType: string): Promise<Blob> {
  const buf = await readFile(filePath);
  return new Blob([new Uint8Array(buf)], { type: mimeType });
}

async function fetchPermalink(
  postId: string,
  token: string,
): Promise<string | null> {
  try {
    const res = await getJson<{ permalink_url?: string }>(
      `${GRAPH}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(token)}`,
    );
    return res.permalink_url ?? null;
  } catch (err) {
    log.warn({ err, postId }, "permalink fetch failed (non-fatal)");
    return null;
  }
}

async function publishImage(
  pp: LoadedPlatformPost,
  token: string,
): Promise<PublishResult> {
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");
  assertImage(first.mediaAsset);

  const blob = await readAsBlob(
    first.mediaAsset.storagePath,
    first.mediaAsset.mimeType,
  );
  const text = composeText(pp);

  type PhotoResponse = { id: string; post_id?: string };
  const res = await postMultipart<PhotoResponse>(
    `${GRAPH}/${pp.account.externalId}/photos`,
    {
      source: blob,
      caption: text,
      published: "true",
      access_token: token,
    },
  );
  const id = res.post_id ?? res.id;
  const permalink = await fetchPermalink(id, token);

  if (pp.post.media.length > 1) {
    log.warn(
      { id: pp.id, count: pp.post.media.length },
      "FB API has no native carousel — published first image only",
    );
  }
  return { externalPostId: id, externalPermalink: permalink };
}

async function publishVideo(
  pp: LoadedPlatformPost,
  token: string,
): Promise<PublishResult> {
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");
  assertVideo(first.mediaAsset);

  const blob = await readAsBlob(
    first.mediaAsset.storagePath,
    first.mediaAsset.mimeType,
  );
  const text = composeText(pp);

  type VideoResponse = { id: string };
  const res = await postMultipart<VideoResponse>(
    `${GRAPH_VIDEO}/${pp.account.externalId}/videos`,
    {
      source: blob,
      description: text,
      access_token: token,
    },
  );
  return {
    externalPostId: res.id,
    externalPermalink: await fetchPermalink(res.id, token),
  };
}

export async function publishFacebook(
  pp: LoadedPlatformPost,
): Promise<PublishResult> {
  const token = await getValidMetaToken(pp.accountId);
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");
  if (first.mediaAsset.mimeType.startsWith("video/")) {
    return publishVideo(pp, token);
  }
  return publishImage(pp, token);
}
