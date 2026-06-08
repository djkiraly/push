import { prisma } from "@/lib/db";
import { decryptToken } from "../accounts";

// Meta Page access tokens derived from a long-lived user token are themselves
// long-lived (effectively non-expiring while the underlying permission grant
// holds). We therefore do not proactively refresh here — if a call returns
// OAuthException/190, we surface that to the operator who must reconnect.

export async function getValidMetaToken(accountId: string): Promise<string> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`Meta account ${accountId} not found`);
  if (!account.enabled) throw new Error(`Meta account ${accountId} is disabled`);
  return decryptToken(account.accessToken);
}
