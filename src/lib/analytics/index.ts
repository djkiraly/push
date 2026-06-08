import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { child } from "@/lib/logger";
import { fetchFacebookMetrics } from "./facebook";
import { fetchInstagramMetrics } from "./instagram";
import { fetchTikTokMetrics } from "./tiktok";
import { fetchYouTubeMetrics } from "./youtube";
import type { FetchOutcome, NormalizedMetrics } from "./types";

const log = child({ module: "analytics" });

const PERMANENT_PATTERNS = [
  /not found/i,
  /invalid.+token/i,
  /permission/i,
  /unauthorized/i,
  /access.+denied/i,
  /scope/i,
  /OAuthException/i,
];

function classify(message: string): boolean {
  return PERMANENT_PATTERNS.some((re) => re.test(message));
}

async function fetchByPlatform(
  platform: Platform,
  accountId: string,
  externalPostId: string,
): Promise<NormalizedMetrics> {
  switch (platform) {
    case "FACEBOOK":
      return fetchFacebookMetrics(accountId, externalPostId);
    case "INSTAGRAM":
      return fetchInstagramMetrics(accountId, externalPostId);
    case "TIKTOK":
      return fetchTikTokMetrics(accountId, externalPostId);
    case "YOUTUBE":
      return fetchYouTubeMetrics(accountId, externalPostId);
  }
}

export async function snapshotPlatformPost(
  platformPostId: string,
): Promise<FetchOutcome> {
  const pp = await prisma.platformPost.findUnique({
    where: { id: platformPostId },
    include: { account: true },
  });
  if (!pp) return { ok: false, error: "not found", permanent: true };
  if (!pp.externalPostId) {
    return { ok: false, error: "no externalPostId", permanent: true };
  }
  if (pp.status !== "PUBLISHED") {
    return { ok: false, error: `status is ${pp.status}`, permanent: false };
  }

  try {
    const metrics = await fetchByPlatform(
      pp.platform,
      pp.accountId,
      pp.externalPostId,
    );
    await prisma.metricSnapshot.create({
      data: {
        platformPostId,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        raw: metrics.raw as object,
      },
    });
    return { ok: true, metrics };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = classify(message);
    log.warn(
      { err: message, platformPostId, platform: pp.platform, permanent },
      "snapshot failed",
    );
    return { ok: false, error: message, permanent };
  }
}
