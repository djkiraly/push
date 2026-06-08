// Runtime-neutral session helpers for use from Edge middleware.
// MUST NOT import next/headers, prisma, or any node:* modules.

import { jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "push_session";

export interface SessionPayload {
  v: 1;
  iat: number;
}

function secret(): Uint8Array {
  const hex = process.env.PUSH_MASTER_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("PUSH_MASTER_KEY missing or malformed");
  }
  // jose accepts a Uint8Array — derive without Node's Buffer for edge runtime.
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.v !== 1) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
