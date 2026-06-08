import { getJson } from "@/lib/platforms/http";
import { getValidMetaToken } from "@/lib/platforms/meta/token";
import type { NormalizedMetrics } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

type Insights = {
  data: Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
};

type MediaResponse = {
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  like_count?: number;
  comments_count?: number;
};

const METRICS_BY_TYPE: Record<string, string> = {
  IMAGE: "reach,impressions,saved",
  VIDEO: "reach,plays,saved,shares,total_interactions",
  CAROUSEL_ALBUM: "reach,impressions,saved,shares",
};

function pick(insights: Insights | undefined, name: string): number | null {
  const block = insights?.data?.find((d) => d.name === name);
  const v = block?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
}

export async function fetchInstagramMetrics(
  accountId: string,
  externalPostId: string,
): Promise<NormalizedMetrics> {
  const token = await getValidMetaToken(accountId);

  const media = await getJson<MediaResponse>(
    `${GRAPH}/${externalPostId}?` +
      new URLSearchParams({
        fields: "media_type,like_count,comments_count",
        access_token: token,
      }).toString(),
  );

  const metricList = METRICS_BY_TYPE[media.media_type ?? "IMAGE"] ?? "reach,saved";
  let insights: Insights | undefined;
  try {
    insights = await getJson<Insights>(
      `${GRAPH}/${externalPostId}/insights?` +
        new URLSearchParams({ metric: metricList, access_token: token }).toString(),
    );
  } catch {
    // Insights can be unavailable in the first hour after publish — fall back
    // to like/comment counts only.
    insights = undefined;
  }

  const reach = pick(insights, "reach");
  const impressions = pick(insights, "impressions");
  const plays = pick(insights, "plays");
  const views = plays ?? impressions ?? reach;

  return {
    views,
    likes: media.like_count ?? null,
    comments: media.comments_count ?? null,
    shares: pick(insights, "shares"),
    raw: { media, insights } as Record<string, unknown>,
  };
}
