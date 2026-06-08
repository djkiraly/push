import { NextResponse, type NextRequest } from "next/server";
import { verifyOAuthState } from "@/lib/platforms/state";
import { connectMeta } from "@/lib/platforms/meta/oauth";
import { child } from "@/lib/logger";

const log = child({ route: "oauth/meta/callback" });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirectToAccounts(req, `error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return redirectToAccounts(req, "error=missing_params");
  }
  const verified = await verifyOAuthState(state, "meta");
  if (!verified) {
    return redirectToAccounts(req, "error=bad_state");
  }

  try {
    const result = await connectMeta(code);
    log.info(result, "meta oauth connected");
    return redirectToAccounts(
      req,
      `connected=meta&fb=${result.facebookPages}&ig=${result.instagramAccounts}`,
    );
  } catch (e) {
    log.error({ err: e }, "meta oauth failed");
    return redirectToAccounts(req, "error=exchange_failed");
  }
}

function redirectToAccounts(req: NextRequest, query: string): NextResponse {
  const dest = new URL(`/settings/accounts?${query}`, req.url);
  return NextResponse.redirect(dest);
}
