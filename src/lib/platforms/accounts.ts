import { prisma } from "@/lib/db";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
import { Prisma, type Account, type Platform } from "@prisma/client";
import type { AccountInput, TokenBundle } from "./types";

export async function upsertAccount(input: AccountInput): Promise<Account> {
  const accessToken = encrypt(input.tokens.accessToken);
  const refreshToken = input.tokens.refreshToken
    ? encrypt(input.tokens.refreshToken)
    : null;
  const metadata: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull;
  return prisma.account.upsert({
    where: {
      platform_externalId: {
        platform: input.platform,
        externalId: input.externalId,
      },
    },
    create: {
      platform: input.platform,
      externalId: input.externalId,
      displayName: input.displayName,
      accessToken,
      refreshToken,
      tokenExpiresAt: input.tokens.expiresAt ?? null,
      scopes: input.tokens.scopes ?? null,
      metadata,
    },
    update: {
      displayName: input.displayName,
      accessToken,
      refreshToken,
      tokenExpiresAt: input.tokens.expiresAt ?? null,
      scopes: input.tokens.scopes ?? null,
      metadata,
      enabled: true,
    },
  });
}

export async function updateAccountTokens(
  accountId: string,
  tokens: TokenBundle,
): Promise<void> {
  await prisma.account.update({
    where: { id: accountId },
    data: {
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresAt ?? null,
      scopes: tokens.scopes ?? null,
    },
  });
}

export function decryptToken(stored: string): string {
  return isEncrypted(stored) ? decrypt(stored) : stored;
}

export async function listAccounts(): Promise<Account[]> {
  return prisma.account.findMany({ orderBy: [{ platform: "asc" }, { displayName: "asc" }] });
}

export async function getAccount(id: string): Promise<Account | null> {
  return prisma.account.findUnique({ where: { id } });
}

export async function deleteAccount(id: string): Promise<void> {
  await prisma.account.delete({ where: { id } });
}

export async function setAccountEnabled(id: string, enabled: boolean): Promise<void> {
  await prisma.account.update({ where: { id }, data: { enabled } });
}

export function platformLabel(p: Platform): string {
  switch (p) {
    case "FACEBOOK":
      return "Facebook";
    case "INSTAGRAM":
      return "Instagram";
    case "TIKTOK":
      return "TikTok";
    case "YOUTUBE":
      return "YouTube";
  }
}
