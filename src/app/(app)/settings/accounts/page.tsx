import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAccounts, platformLabel } from "@/lib/platforms/accounts";
import {
  getAllProviderConfigs,
  toStatus,
} from "@/lib/platforms/oauth-config";
import { ProviderCard } from "./provider-card";
import { AccountRow } from "./account-row";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  connected?: string;
  error?: string;
  fb?: string;
  ig?: string;
}>;

export default async function AccountsSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.ReactElement> {
  const [accounts, allConfigs, sp] = await Promise.all([
    listAccounts(),
    getAllProviderConfigs(),
    searchParams,
  ]);

  const providers = {
    meta: toStatus(allConfigs.meta),
    tiktok: toStatus(allConfigs.tiktok),
    google: toStatus(allConfigs.google),
  };

  return (
    <>
      <PageHeader
        title="Connected accounts"
        description="Configure each platform's app credentials, then click Connect to authorize Push. App secrets and access tokens are encrypted at rest."
      />

      {sp.error ? (
        <Card className="mb-4 border border-red-900/60 bg-red-950/30">
          <p className="text-sm text-red-300">OAuth failed: {sp.error}</p>
        </Card>
      ) : null}
      {sp.connected ? (
        <Card className="mb-4 border border-emerald-900/60 bg-emerald-950/30">
          <p className="text-sm text-emerald-300">
            Connected {sp.connected}
            {sp.connected === "meta" && sp.fb && sp.ig
              ? ` — ${sp.fb} Facebook Page(s), ${sp.ig} Instagram account(s)`
              : ""}
            .
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <ProviderCard
          provider="meta"
          title="Facebook + Instagram"
          docsHref="https://developers.facebook.com/apps"
          docsLabel="Meta for Developers"
          idLabel="App ID"
          secretLabel="App Secret"
          idHint="Numeric Meta App ID (Settings → Basic in your Meta app)"
          secretHint="Click 'Show' in Meta to reveal, paste here."
          status={providers.meta}
          extra={
            <p className="mt-2 text-[11px] text-zinc-500">
              Add Facebook Login for Business as a product. Add the redirect
              URI below to <em>Valid OAuth Redirect URIs</em>. Request these
              permissions: <code>pages_show_list, pages_manage_posts,
              pages_read_engagement, business_management, instagram_basic,
              instagram_content_publish</code>.
            </p>
          }
        />
        <ProviderCard
          provider="tiktok"
          title="TikTok"
          docsHref="https://developers.tiktok.com/apps"
          docsLabel="TikTok for Developers"
          idLabel="Client Key"
          secretLabel="Client Secret"
          idHint="Login Kit + Content Posting API enabled."
          secretHint="From your TikTok app settings."
          status={providers.tiktok}
          extra={
            <p className="mt-2 text-[11px] text-zinc-500">
              Add the redirect URI below under <em>Redirect URI</em>. Request
              scopes: <code>user.info.basic, video.publish, video.upload,
              video.list</code>.
            </p>
          }
        />
        <ProviderCard
          provider="google"
          title="YouTube (Google)"
          docsHref="https://console.cloud.google.com/apis/credentials"
          docsLabel="Google Cloud Console"
          idLabel="Client ID"
          secretLabel="Client Secret"
          idHint="OAuth 2.0 Client ID (Web application)."
          secretHint="Created with the OAuth client."
          status={providers.google}
          extra={
            <p className="mt-2 text-[11px] text-zinc-500">
              Enable <em>YouTube Data API v3</em> on the project. Add the
              redirect URI below to your OAuth client&apos;s{" "}
              <em>Authorized redirect URIs</em>.
            </p>
          }
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Connected ({accounts.length})</CardTitle>
          <CardDescription>
            Disable to skip an account during scheduling, or disconnect to
            revoke the stored token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-zinc-500">No accounts connected yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {accounts.map((a) => (
                <AccountRow
                  key={a.id}
                  id={a.id}
                  platform={platformLabel(a.platform)}
                  displayName={a.displayName}
                  externalId={a.externalId}
                  enabled={a.enabled}
                  tokenExpiresAt={
                    a.tokenExpiresAt ? a.tokenExpiresAt.toISOString() : null
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
