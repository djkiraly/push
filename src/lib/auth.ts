import argon2 from "argon2";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";
import { getSetting, setSetting, SettingKeys } from "./settings";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionPayload,
} from "./auth-edge";

const COOKIE_NAME = SESSION_COOKIE_NAME;
const SESSION_TTL_DAYS = 30;

function secret(): Uint8Array {
  // Re-use master key bytes as the JWT signing secret. It's a 32-byte secret
  // already, never leaves the host, and only one process ever signs/verifies.
  return Buffer.from(env().PUSH_MASTER_KEY, "hex");
}

export type { SessionPayload };
export { SESSION_COOKIE_NAME, verifySessionToken };

export async function isPasswordSet(): Promise<boolean> {
  const hash = await getSetting<string>(SettingKeys.uiPasswordHash);
  return typeof hash === "string" && hash.length > 0;
}

export async function setPassword(plaintext: string): Promise<void> {
  if (plaintext.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const hash = await argon2.hash(plaintext, { type: argon2.argon2id });
  await setSetting(SettingKeys.uiPasswordHash, hash);
}

export async function verifyPassword(plaintext: string): Promise<boolean> {
  const hash = await getSetting<string>(SettingKeys.uiPasswordHash);
  if (!hash) return false;
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

export async function createSessionCookie(): Promise<void> {
  const token = await new SignJWT({ v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // localhost only — never served over external network
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function readSessionFromCookie(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
