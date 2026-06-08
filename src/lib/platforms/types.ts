import type { Platform } from "@prisma/client";

export type { Platform };

export type OAuthStartResult = {
  authUrl: string;
  state: string;
};

export type TokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string | null;
};

export type AccountInput = {
  platform: Platform;
  externalId: string;
  displayName: string;
  tokens: TokenBundle;
  metadata?: Record<string, unknown> | null;
};
