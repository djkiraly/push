import { google } from "googleapis";
import { getYouTubeOAuthClient } from "@/lib/platforms/youtube/token";
import type { NormalizedMetrics } from "./types";

function toInt(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchYouTubeMetrics(
  accountId: string,
  externalPostId: string,
): Promise<NormalizedMetrics> {
  const auth = await getYouTubeOAuthClient(accountId);
  const youtube = google.youtube({ version: "v3", auth });
  const res = await youtube.videos.list({
    id: [externalPostId],
    part: ["statistics"],
  });
  const stats = res.data.items?.[0]?.statistics ?? {};
  return {
    views: toInt(stats.viewCount),
    likes: toInt(stats.likeCount),
    comments: toInt(stats.commentCount),
    // YouTube has no native share count surfaced in v3 API.
    shares: null,
    raw: stats as Record<string, unknown>,
  };
}
