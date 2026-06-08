import type { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";
import { decryptToken, updateAccountTokens } from "../accounts";
import { createOAuthClient } from "./oauth";

export async function getYouTubeOAuthClient(accountId: string): Promise<OAuth2Client> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`YouTube account ${accountId} not found`);
  if (!account.enabled) throw new Error(`YouTube account ${accountId} is disabled`);

  const client = await createOAuthClient();
  client.setCredentials({
    access_token: decryptToken(account.accessToken),
    refresh_token: account.refreshToken ? decryptToken(account.refreshToken) : undefined,
    expiry_date: account.tokenExpiresAt?.getTime(),
    scope: account.scopes ?? undefined,
  });

  // Persist refreshed tokens whenever google-auth refreshes under the hood.
  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    void updateAccountTokens(accountId, {
      accessToken: tokens.access_token,
      // google only re-sends refresh_token on the very first grant — keep the
      // existing one when omitted.
      refreshToken:
        tokens.refresh_token ??
        (account.refreshToken ? decryptToken(account.refreshToken) : null),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope ?? account.scopes ?? null,
    }).catch(() => {});
  });

  return client;
}
