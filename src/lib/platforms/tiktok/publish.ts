import { readFile, stat } from "node:fs/promises";
import { request } from "undici";
import { postJson } from "../http";
import { getValidTikTokToken } from "./token";
import {
  assertVideo,
  composeText,
  type LoadedPlatformPost,
} from "../publish-context";
import { child } from "@/lib/logger";

const log = child({ module: "publisher/tiktok" });

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_MS = 5 * 60 * 1000;

type InitResponse = {
  data: {
    publish_id: string;
    upload_url: string;
  };
};

type StatusResponse = {
  data: {
    publish_id: string;
    status:
      | "PROCESSING_UPLOAD"
      | "PROCESSING_DOWNLOAD"
      | "SEND_TO_USER_INBOX"
      | "PUBLISH_COMPLETE"
      | "FAILED"
      | string;
    fail_reason?: string;
    publicaly_available_post_id?: string[];
  };
};

export type PublishResult = {
  externalPostId: string;
  externalPermalink: string | null;
};

async function uploadChunked(
  uploadUrl: string,
  filePath: string,
  size: number,
  mimeType: string,
): Promise<void> {
  // TikTok allows a single PUT when file ≤64MB and ≥5MB; under 5MB also works
  // as a single chunk. For simplicity we send one PUT and rely on TikTok's
  // tolerance for our typical short-form videos.
  const body = await readFile(filePath);
  const res = await request(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": mimeType,
      "content-range": `bytes 0-${size - 1}/${size}`,
      "content-length": String(size),
    },
    body: new Uint8Array(body),
  });
  if (res.statusCode >= 400) {
    const text = await res.body.text();
    throw new Error(`TikTok upload failed (${res.statusCode}): ${text}`);
  }
}

async function pollPublishStatus(
  token: string,
  publishId: string,
): Promise<StatusResponse["data"]> {
  const deadline = Date.now() + MAX_POLL_MS;
  while (Date.now() < deadline) {
    const res = await postJson<StatusResponse>(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      { publish_id: publishId },
      { authorization: `Bearer ${token}` },
    );
    const s = res.data.status;
    if (s === "PUBLISH_COMPLETE" || s === "SEND_TO_USER_INBOX") return res.data;
    if (s === "FAILED") {
      throw new Error(`TikTok publish failed: ${res.data.fail_reason ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("TikTok publish polling timed out");
}

export async function publishTikTok(pp: LoadedPlatformPost): Promise<PublishResult> {
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");
  assertVideo(first.mediaAsset);

  const token = await getValidTikTokToken(pp.accountId);
  const filePath = first.mediaAsset.storagePath;
  const fileStat = await stat(filePath);
  const fileSize = fileStat.size;

  const text = composeText(pp).slice(0, 2200);

  // Try DIRECT_POST first; fall back to inbox on permission failure.
  let inbox = false;
  let initRes: InitResponse;
  try {
    initRes = await postJson<InitResponse>(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        post_info: {
          title: text,
          privacy_level: "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: fileSize,
          chunk_size: fileSize,
          total_chunk_count: 1,
        },
      },
      { authorization: `Bearer ${token}` },
    );
  } catch (err) {
    log.warn(
      { err },
      "TikTok DIRECT_POST init failed — falling back to inbox MEDIA_UPLOAD",
    );
    inbox = true;
    initRes = await postJson<InitResponse>(
      "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
      {
        source_info: {
          source: "FILE_UPLOAD",
          video_size: fileSize,
          chunk_size: fileSize,
          total_chunk_count: 1,
        },
      },
      { authorization: `Bearer ${token}` },
    );
  }

  await uploadChunked(
    initRes.data.upload_url,
    filePath,
    fileSize,
    first.mediaAsset.mimeType,
  );

  const status = await pollPublishStatus(token, initRes.data.publish_id);
  const externalPostId = status.publicaly_available_post_id?.[0] ?? initRes.data.publish_id;

  if (inbox) {
    log.info(
      { id: pp.id, publishId: initRes.data.publish_id },
      "TikTok upload sent to inbox — operator must finish posting in the TikTok app",
    );
  }

  return { externalPostId, externalPermalink: null };
}
