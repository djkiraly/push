import { createHash, randomBytes } from "node:crypto";
import { getJson, postForm } from "../http";
import { upsertAccount } from "../accounts";
import { getProviderConfig } from "../oauth-config";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name";

const SCOPES = [
  "user.info.basic",
  "video.publish",
  "video.upload",
  "video.list",
];

export async function requireTikTokConfig(): Promise<{
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
}> {
  const c = await getProviderConfig("tiktok");
  if (!c.configured || !c.clientId || !c.clientSecret) {
    throw new Error(
      "TikTok OAuth not configured. Add Client Key and Client Secret on Settings → Accounts.",
    );
  }
  return {
    clientKey: c.clientId,
    clientSecret: c.clientSecret,
    redirectUri: c.redirectUri,
  };
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export async function buildAuthUrl(state: string, codeChallenge: string): Promise<string> {
  const cfg = await requireTikTokConfig();
  const params = new URLSearchParams({
    client_key: cfg.clientKey,
    scope: SCOPES.join(","),
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  open_id: string;
  scope: string;
  token_type: string;
};

export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const cfg = await requireTikTokConfig();
  return postForm<TokenResponse>(TOKEN_URL, {
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code_verifier: codeVerifier,
  });
}

export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const cfg = await requireTikTokConfig();
  return postForm<TokenResponse>(TOKEN_URL, {
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
}

type UserInfoResponse = {
  data?: {
    user?: {
      open_id: string;
      union_id?: string;
      avatar_url?: string;
      display_name?: string;
    };
  };
};

async function fetchUserInfo(accessToken: string): Promise<UserInfoResponse["data"]> {
  const res = await getJson<UserInfoResponse>(USER_INFO_URL, {
    authorization: `Bearer ${accessToken}`,
  });
  return res.data;
}

export async function connectTikTok(
  code: string,
  codeVerifier: string,
): Promise<{ openId: string; displayName: string }> {
  const token = await exchangeCode(code, codeVerifier);
  const info = await fetchUserInfo(token.access_token);
  const displayName =
    info?.user?.display_name ??
    `TikTok ${token.open_id.slice(0, 6)}`;

  await upsertAccount({
    platform: "TIKTOK",
    externalId: token.open_id,
    displayName,
    tokens: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes: token.scope,
    },
    metadata: {
      openId: token.open_id,
      unionId: info?.user?.union_id ?? null,
      avatarUrl: info?.user?.avatar_url ?? null,
      refreshExpiresAt: token.refresh_expires_in
        ? new Date(Date.now() + token.refresh_expires_in * 1000).toISOString()
        : null,
    },
  });

  return { openId: token.open_id, displayName };
}
