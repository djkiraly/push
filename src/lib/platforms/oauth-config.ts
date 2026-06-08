import { env } from "@/lib/env";
import { getSetting, SettingKeys } from "@/lib/settings";

export type ProviderKey = "meta" | "tiktok" | "google";

export type ResolvedProviderConfig = {
  configured: boolean;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string;
  idSource: "settings" | "env" | "none";
  secretSource: "settings" | "env" | "none";
};

// Canonical redirect URI for OAuth callbacks. We don't ask the operator to
// type it — they only need to copy it into each provider's developer console.
export function redirectUriFor(provider: ProviderKey): string {
  const e = env();
  // The OAuth callbacks are reached by a browser, so we use the same host the
  // operator sees in their address bar — usually localhost. 127.0.0.1 works
  // too, but localhost is friendlier when copying into a developer console.
  const host = e.PUSH_HOST === "127.0.0.1" ? "localhost" : e.PUSH_HOST;
  const base = `http://${host}:${e.PUSH_PORT}`;
  switch (provider) {
    case "meta":
      return `${base}/api/oauth/meta/callback`;
    case "tiktok":
      return `${base}/api/oauth/tiktok/callback`;
    case "google":
      return `${base}/api/oauth/google/callback`;
  }
}

async function resolveOne(
  provider: ProviderKey,
): Promise<ResolvedProviderConfig> {
  const e = env();
  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let idSource: "settings" | "env" | "none" = "none";
  let secretSource: "settings" | "env" | "none" = "none";

  if (provider === "meta") {
    const settingId = await getSetting<string>(SettingKeys.metaAppId);
    const settingSecret = await getSetting<string>(SettingKeys.metaAppSecret);
    if (settingId) {
      clientId = settingId;
      idSource = "settings";
    } else if (e.META_APP_ID) {
      clientId = e.META_APP_ID;
      idSource = "env";
    }
    if (settingSecret) {
      clientSecret = settingSecret;
      secretSource = "settings";
    } else if (e.META_APP_SECRET) {
      clientSecret = e.META_APP_SECRET;
      secretSource = "env";
    }
  } else if (provider === "tiktok") {
    const settingId = await getSetting<string>(SettingKeys.tiktokClientKey);
    const settingSecret = await getSetting<string>(SettingKeys.tiktokClientSecret);
    if (settingId) {
      clientId = settingId;
      idSource = "settings";
    } else if (e.TIKTOK_CLIENT_KEY) {
      clientId = e.TIKTOK_CLIENT_KEY;
      idSource = "env";
    }
    if (settingSecret) {
      clientSecret = settingSecret;
      secretSource = "settings";
    } else if (e.TIKTOK_CLIENT_SECRET) {
      clientSecret = e.TIKTOK_CLIENT_SECRET;
      secretSource = "env";
    }
  } else if (provider === "google") {
    const settingId = await getSetting<string>(SettingKeys.googleClientId);
    const settingSecret = await getSetting<string>(SettingKeys.googleClientSecret);
    if (settingId) {
      clientId = settingId;
      idSource = "settings";
    } else if (e.GOOGLE_CLIENT_ID) {
      clientId = e.GOOGLE_CLIENT_ID;
      idSource = "env";
    }
    if (settingSecret) {
      clientSecret = settingSecret;
      secretSource = "settings";
    } else if (e.GOOGLE_CLIENT_SECRET) {
      clientSecret = e.GOOGLE_CLIENT_SECRET;
      secretSource = "env";
    }
  }

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri: redirectUriFor(provider),
    idSource,
    secretSource,
  };
}

export async function getProviderConfig(
  provider: ProviderKey,
): Promise<ResolvedProviderConfig> {
  return resolveOne(provider);
}

export async function getAllProviderConfigs(): Promise<
  Record<ProviderKey, ResolvedProviderConfig>
> {
  const [meta, tiktok, google] = await Promise.all([
    resolveOne("meta"),
    resolveOne("tiktok"),
    resolveOne("google"),
  ]);
  return { meta, tiktok, google };
}

// Status form for the UI — never includes the secret value.
export type ProviderStatus = Omit<ResolvedProviderConfig, "clientSecret"> & {
  hasSecret: boolean;
};

export function toStatus(c: ResolvedProviderConfig): ProviderStatus {
  return {
    configured: c.configured,
    clientId: c.clientId,
    redirectUri: c.redirectUri,
    idSource: c.idSource,
    secretSource: c.secretSource,
    hasSecret: Boolean(c.clientSecret),
  };
}
