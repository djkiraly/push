import { prisma } from "./db";
import { decrypt, encrypt, isEncrypted } from "./crypto";

// Setting values are JSON-encoded strings. Sensitive keys are encrypted
// before JSON-stringification: encrypt(JSON.stringify(value)).
// Treat anything matching the encryption prefix as encrypted-at-rest.

const ENCRYPTED_KEYS = new Set<string>([
  "ai.anthropicKey",
  "ai.openaiKey",
  "oauth.meta.appSecret",
  "oauth.tiktok.clientSecret",
  "oauth.google.clientSecret",
]);

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return null;
  const raw = ENCRYPTED_KEYS.has(key) && isEncrypted(row.value)
    ? decrypt(row.value)
    : row.value;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  const stored = ENCRYPTED_KEYS.has(key) ? encrypt(json) : json;
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: stored },
    update: { value: stored },
  });
}

export async function deleteSetting(key: string): Promise<void> {
  await prisma.setting.delete({ where: { key } }).catch(() => {});
}

export const SettingKeys = {
  uiPasswordHash: "ui.passwordHash",
  uiInstallId: "ui.installId",
  watchFolderEnabled: "watch.enabled",
  watchFolderMoveProcessed: "watch.moveProcessed",
  requireApproval: "posts.requireApproval",
  aiProvider: "ai.provider",
  aiModel: "ai.model",
  aiAnthropicKey: "ai.anthropicKey",
  aiOpenaiKey: "ai.openaiKey",
  metaAppId: "oauth.meta.appId",
  metaAppSecret: "oauth.meta.appSecret",
  tiktokClientKey: "oauth.tiktok.clientKey",
  tiktokClientSecret: "oauth.tiktok.clientSecret",
  googleClientId: "oauth.google.clientId",
  googleClientSecret: "oauth.google.clientSecret",
} as const;
