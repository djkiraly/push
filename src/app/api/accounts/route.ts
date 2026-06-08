import { ok, failFromException } from "@/lib/api";
import { listAccounts } from "@/lib/platforms/accounts";

export async function GET() {
  try {
    const accounts = await listAccounts();
    return ok(
      accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        displayName: a.displayName,
        externalId: a.externalId,
        enabled: a.enabled,
        tokenExpiresAt: a.tokenExpiresAt,
        scopes: a.scopes,
        createdAt: a.createdAt,
      })),
    );
  } catch (e) {
    return failFromException(e);
  }
}
