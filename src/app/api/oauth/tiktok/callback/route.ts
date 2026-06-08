import { NextResponse, type NextRequest } from "next/server";
import { verifyOAuthState } from "@/lib/platforms/state";
import { connectTikTok } from "@/lib/platforms/tiktok/oauth";
import { child } from "@/lib/logger";

const log = child({ route: "oauth/tiktok/callback" });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirectToAccounts(req, `error=${encodeURIComponent(error)}`);
  if (!code || !state) return redirectToAccounts(req, "error=missing_params");

  const verified = await verifyOAuthState(state, "tiktok");
  if (!verified || !verified.cv) {
    return redirectToAccounts(req, "error=bad_state");
  }

  try {
    const result = await connectTikTok(code, verified.cv);
    log.info({ openId: result.openId }, "tiktok oauth connected");
    return redirectToAccounts(req, "connected=tiktok");
  } catch (e) {
    log.error({ err: e }, "tiktok oauth failed");
    return redirectToAccounts(req, "error=exchange_failed");
  }
}

function redirectToAccounts(req: NextRequest, query: string): NextResponse {
  return NextResponse.redirect(new URL(`/settings/accounts?${query}`, req.url));
}
