import { NextResponse } from "next/server";
import { signOAuthState } from "@/lib/platforms/state";
import { buildAuthUrl, requireMetaConfig } from "@/lib/platforms/meta/oauth";
import { fail } from "@/lib/api";

export async function GET(): Promise<NextResponse> {
  try {
    await requireMetaConfig();
  } catch (e) {
    return fail((e as Error).message, 400);
  }
  const state = await signOAuthState("meta");
  const url = await buildAuthUrl(state);
  return NextResponse.redirect(url);
}
