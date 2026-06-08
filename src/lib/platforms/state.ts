import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const STATE_TTL_SECONDS = 600;

function secret(): Uint8Array {
  return Buffer.from(env().PUSH_MASTER_KEY, "hex");
}

export type OAuthStatePayload = {
  p: string;
  n: string;
  cv?: string;
};

export async function signOAuthState(
  platform: string,
  extra?: { codeVerifier?: string },
): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  const payload: OAuthStatePayload = { p: platform, n: nonce };
  if (extra?.codeVerifier) payload.cv = extra.codeVerifier;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyOAuthState(
  token: string,
  expectedPlatform: string,
): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.p !== expectedPlatform) return null;
    return payload as unknown as OAuthStatePayload;
  } catch {
    return null;
  }
}
