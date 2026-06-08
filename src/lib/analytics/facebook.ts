import { getJson } from "@/lib/platforms/http";
import { getValidMetaToken } from "@/lib/platforms/meta/token";
import type { NormalizedMetrics } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

type SummaryShape = {
  data: number;
};

type PostFieldsResponse = {
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  insights?: { data: Array<{ name: string; values: Array<{ value: number | SummaryShape }> }> };
};

export async function fetchFacebookMetrics(
  accountId: string,
  externalPostId: string,
): Promise<NormalizedMetrics> {
  const token = await getValidMetaToken(accountId);
  const params = new URLSearchParams({
    fields:
      "likes.summary(true).limit(0),comments.summary(true).limit(0),shares,insights.metric(post_impressions)",
    access_token: token,
  });
  const res = await getJson<PostFieldsResponse>(
    `${GRAPH}/${externalPostId}?${params.toString()}`,
  );

  const impressionsBlock = res.insights?.data?.find(
    (d) => d.name === "post_impressions",
  );
  const rawImp = impressionsBlock?.values?.[0]?.value;
  const views =
    typeof rawImp === "number"
      ? rawImp
      : typeof (rawImp as SummaryShape | undefined)?.data === "number"
        ? (rawImp as SummaryShape).data
        : null;

  return {
    views,
    likes: res.likes?.summary?.total_count ?? null,
    comments: res.comments?.summary?.total_count ?? null,
    shares: res.shares?.count ?? null,
    raw: res as unknown as Record<string, unknown>,
  };
}
