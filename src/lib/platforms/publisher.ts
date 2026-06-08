import { loadPlatformPost } from "./publish-context";
import { publishFacebook } from "./facebook/publish";
import { publishInstagram } from "./instagram/publish";
import { publishTikTok } from "./tiktok/publish";
import { publishYouTube } from "./youtube/publish";

export type DispatchResult =
  | { ok: true; externalPostId: string; externalPermalink: string | null }
  | { ok: false; error: string; transient: boolean };

const TRANSIENT_PATTERNS = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /rate.?limit/i,
  /timeout/i,
  /try again/i,
  /5\d{2}/, // 5xx response codes embedded in error messages
];

export function classify(err: unknown): { transient: boolean; message: string } {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
  const transient = TRANSIENT_PATTERNS.some((re) => re.test(message));
  return { transient, message };
}

export async function dispatch(platformPostId: string): Promise<DispatchResult> {
  const pp = await loadPlatformPost(platformPostId);
  if (!pp) return { ok: false, error: "PlatformPost not found", transient: false };

  try {
    let result;
    switch (pp.platform) {
      case "FACEBOOK":
        result = await publishFacebook(pp);
        break;
      case "INSTAGRAM":
        result = await publishInstagram(pp);
        break;
      case "TIKTOK":
        result = await publishTikTok(pp);
        break;
      case "YOUTUBE":
        result = await publishYouTube(pp);
        break;
    }
    return {
      ok: true,
      externalPostId: result.externalPostId,
      externalPermalink: result.externalPermalink,
    };
  } catch (err) {
    const { transient, message } = classify(err);
    return { ok: false, error: message, transient };
  }
}
