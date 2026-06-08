import { env } from "@/lib/env";
import { getSetting, SettingKeys } from "@/lib/settings";

export type AiProvider = "anthropic" | "openai";

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
};

export type ResolvedAiConfig = {
  provider: AiProvider;
  model: string;
  apiKey: string;
};

export async function getAiConfig(): Promise<ResolvedAiConfig | null> {
  const provider =
    (await getSetting<AiProvider>(SettingKeys.aiProvider)) ?? "anthropic";
  const model =
    (await getSetting<string>(SettingKeys.aiModel)) ?? DEFAULT_MODELS[provider];

  let apiKey: string | null = null;
  if (provider === "anthropic") {
    apiKey =
      (await getSetting<string>(SettingKeys.aiAnthropicKey)) ??
      env().ANTHROPIC_API_KEY ??
      null;
  } else {
    apiKey =
      (await getSetting<string>(SettingKeys.aiOpenaiKey)) ??
      env().OPENAI_API_KEY ??
      null;
  }
  if (!apiKey) return null;

  return { provider, model, apiKey };
}

export async function getAiConfigStatus(): Promise<{
  provider: AiProvider;
  model: string;
  hasKey: boolean;
  keySource: "settings" | "env" | "none";
}> {
  const provider =
    (await getSetting<AiProvider>(SettingKeys.aiProvider)) ?? "anthropic";
  const model =
    (await getSetting<string>(SettingKeys.aiModel)) ?? DEFAULT_MODELS[provider];

  const settingKey =
    provider === "anthropic"
      ? await getSetting<string>(SettingKeys.aiAnthropicKey)
      : await getSetting<string>(SettingKeys.aiOpenaiKey);
  if (settingKey) return { provider, model, hasKey: true, keySource: "settings" };

  const envKey =
    provider === "anthropic"
      ? env().ANTHROPIC_API_KEY
      : env().OPENAI_API_KEY;
  if (envKey) return { provider, model, hasKey: true, keySource: "env" };

  return { provider, model, hasKey: false, keySource: "none" };
}
