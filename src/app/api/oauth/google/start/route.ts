import { NextResponse } from "next/server";
import { signOAuthState } from "@/lib/platforms/state";
import { buildAuthUrl, requireGoogleConfig } from "@/lib/platforms/youtube/oauth";
import { fail } from "@/lib/api";

export async function GET(): Promise<NextResponse> {
  try {
    await requireGoogleConfig();
  } catch (e) {
    return fail((e as Error).message, 400);
  }
  const state = await signOAuthState("google");
  const url = await buildAuthUrl(state);
  return NextResponse.redirect(url);
}
