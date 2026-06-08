import { getJson } from "../http";
import { upsertAccount } from "../accounts";
import { getProviderConfig } from "../oauth-config";

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
];

export async function requireMetaConfig(): Promise<{
  appId: string;
  appSecret: string;
  redirectUri: string;
}> {
  const c = await getProviderConfig("meta");
  if (!c.configured || !c.clientId || !c.clientSecret) {
    throw new Error(
      "Meta OAuth not configured. Add App ID and App Secret on Settings → Accounts.",
    );
  }
  return {
    appId: c.clientId,
    appSecret: c.clientSecret,
    redirectUri: c.redirectUri,
  };
}

export async function buildAuthUrl(state: string): Promise<string> {
  const cfg = await requireMetaConfig();
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state,
    response_type: "code",
    scope: SCOPES.join(","),
  });
  return `${DIALOG}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const cfg = await requireMetaConfig();
  const url =
    `${GRAPH}/oauth/access_token?` +
    new URLSearchParams({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      redirect_uri: cfg.redirectUri,
      code,
    }).toString();
  const res = await getJson<TokenResponse>(url);
  return res.access_token;
}

export async function exchangeForLongLivedUserToken(shortLived: string): Promise<{
  accessToken: string;
  expiresAt: Date | null;
}> {
  const cfg = await requireMetaConfig();
  const url =
    `${GRAPH}/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: shortLived,
    }).toString();
  const res = await getJson<TokenResponse>(url);
  const expiresAt = res.expires_in
    ? new Date(Date.now() + res.expires_in * 1000)
    : null;
  return { accessToken: res.access_token, expiresAt };
}

type Page = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

type PagesResponse = {
  data: Page[];
};

export async function fetchPages(userToken: string): Promise<Page[]> {
  const url =
    `${GRAPH}/me/accounts?` +
    new URLSearchParams({
      fields:
        "id,name,access_token,instagram_business_account{id,username}",
      access_token: userToken,
    }).toString();
  const res = await getJson<PagesResponse>(url);
  return res.data ?? [];
}

export type ConnectMetaResult = {
  facebookPages: number;
  instagramAccounts: number;
};

export async function connectMeta(code: string): Promise<ConnectMetaResult> {
  const shortLived = await exchangeCodeForUserToken(code);
  const { accessToken: longLivedUser, expiresAt: userExpiry } =
    await exchangeForLongLivedUserToken(shortLived);

  const pages = await fetchPages(longLivedUser);
  let fbCount = 0;
  let igCount = 0;

  for (const page of pages) {
    await upsertAccount({
      platform: "FACEBOOK",
      externalId: page.id,
      displayName: page.name,
      tokens: {
        accessToken: page.access_token,
        expiresAt: userExpiry,
        scopes: SCOPES.join(","),
      },
      metadata: { pageId: page.id },
    });
    fbCount++;

    const ig = page.instagram_business_account;
    if (ig?.id) {
      await upsertAccount({
        platform: "INSTAGRAM",
        externalId: ig.id,
        displayName: ig.username ? `@${ig.username}` : `IG (${page.name})`,
        tokens: {
          accessToken: page.access_token,
          expiresAt: userExpiry,
          scopes: SCOPES.join(","),
        },
        metadata: { igUserId: ig.id, linkedPageId: page.id },
      });
      igCount++;
    }
  }

  return { facebookPages: fbCount, instagramAccounts: igCount };
}
