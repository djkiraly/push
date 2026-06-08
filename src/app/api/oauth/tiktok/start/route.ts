import { NextResponse } from "next/server";
import { signOAuthState } from "@/lib/platforms/state";
import {
  buildAuthUrl,
  generatePkce,
  requireTikTokConfig,
} from "@/lib/platforms/tiktok/oauth";
import { fail } from "@/lib/api";

export async function GET(): Promise<NextResponse> {
  try {
    await requireTikTokConfig();
  } catch (e) {
    return fail((e as Error).message, 400);
  }
  const { verifier, challenge } = generatePkce();
  const state = await signOAuthState("tiktok", { codeVerifier: verifier });
  const url = await buildAuthUrl(state, challenge);
  return NextResponse.redirect(url);
}
