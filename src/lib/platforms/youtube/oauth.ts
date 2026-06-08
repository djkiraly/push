import { google } from "googleapis";
import { upsertAccount } from "../accounts";
import { getProviderConfig } from "../oauth-config";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export async function requireGoogleConfig(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}> {
  const c = await getProviderConfig("google");
  if (!c.configured || !c.clientId || !c.clientSecret) {
    throw new Error(
      "Google/YouTube OAuth not configured. Add Client ID and Client Secret on Settings → Accounts.",
    );
  }
  return {
    clientId: c.clientId,
    clientSecret: c.clientSecret,
    redirectUri: c.redirectUri,
  };
}

export async function createOAuthClient() {
  const cfg = await requireGoogleConfig();
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export async function buildAuthUrl(state: string): Promise<string> {
  const client = await createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function connectYouTube(code: string): Promise<{
  channelId: string;
  channelTitle: string;
}> {
  const client = await createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google: no access_token returned");
  }
  client.setCredentials(tokens);

  const yt = google.youtube({ version: "v3", auth: client });
  const res = await yt.channels.list({
    mine: true,
    part: ["id", "snippet"],
  });
  const channel = res.data.items?.[0];
  if (!channel?.id) {
    throw new Error("YouTube: no channel found for authenticated user");
  }
  const channelTitle = channel.snippet?.title ?? `Channel ${channel.id.slice(0, 6)}`;
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  await upsertAccount({
    platform: "YOUTUBE",
    externalId: channel.id,
    displayName: channelTitle,
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      scopes: tokens.scope ?? SCOPES.join(" "),
    },
    metadata: {
      channelId: channel.id,
      tokenType: tokens.token_type ?? null,
    },
  });

  return { channelId: channel.id, channelTitle };
}
