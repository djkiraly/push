import { postJson } from "@/lib/platforms/http";
import { getValidTikTokToken } from "@/lib/platforms/tiktok/token";
import type { NormalizedMetrics } from "./types";

type QueryResponse = {
  data?: {
    videos?: Array<{
      id: string;
      view_count?: number;
      like_count?: number;
      comment_count?: number;
      share_count?: number;
      title?: string;
    }>;
  };
};

export async function fetchTikTokMetrics(
  accountId: string,
  externalPostId: string,
): Promise<NormalizedMetrics> {
  const token = await getValidTikTokToken(accountId);

  // Requires scope video.list — granted via OAuth. If not granted the call
  // returns 403 and our caller marks it as permanent so we stop retrying.
  const res = await postJson<QueryResponse>(
    "https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count,title",
    { filters: { video_ids: [externalPostId] } },
    { authorization: `Bearer ${token}` },
  );

  const v = res.data?.videos?.[0];
  return {
    views: v?.view_count ?? null,
    likes: v?.like_count ?? null,
    comments: v?.comment_count ?? null,
    shares: v?.share_count ?? null,
    raw: (v ?? {}) as Record<string, unknown>,
  };
}
