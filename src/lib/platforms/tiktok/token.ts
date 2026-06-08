import { prisma } from "@/lib/db";
import { decryptToken, updateAccountTokens } from "../accounts";
import { refreshToken } from "./oauth";

const REFRESH_LEEWAY_MS = 5 * 60 * 1000; // refresh if <5 min left

export async function getValidTikTokToken(accountId: string): Promise<string> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`TikTok account ${accountId} not found`);
  if (!account.enabled) throw new Error(`TikTok account ${accountId} is disabled`);

  const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
  const nearExpiry = expiresAt - Date.now() < REFRESH_LEEWAY_MS;

  if (!nearExpiry) {
    return decryptToken(account.accessToken);
  }

  if (!account.refreshToken) {
    throw new Error(
      "TikTok token near expiry but no refresh_token stored — reconnect the account",
    );
  }
  const refresh = decryptToken(account.refreshToken);
  const result = await refreshToken(refresh);
  await updateAccountTokens(accountId, {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope,
  });
  return result.access_token;
}
