import { z } from "zod";
import { postJson } from "@/lib/platforms/http";
import { getAiConfig, type ResolvedAiConfig } from "./providers";
import { child } from "@/lib/logger";
import type { Platform } from "@prisma/client";

const log = child({ module: "ai/generate" });

const PLATFORM_GUIDANCE: Record<Platform, string> = {
  FACEBOOK:
    "Conversational, longer-form is OK (1–3 short paragraphs). Soft CTA. Few hashtags (0–3). No emojis spam.",
  INSTAGRAM:
    "Punchy hook in line 1, then 2–4 short lines. Friendly tone. End with 8–15 relevant hashtags in a separate block.",
  TIKTOK:
    "Very short (≤150 chars). Direct hook. 2–5 trending hashtags, no spaces.",
  YOUTUBE:
    "Shorts: catchy title-style first line. Description body 1–2 short paragraphs. Always include #Shorts. 5–10 hashtags total.",
};

export type CaptionVariant = {
  platform: Platform;
  caption: string;
  hashtags: string;
};

const VariantSchema = z.object({
  platform: z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE"]),
  caption: z.string().min(1),
  hashtags: z.string().default(""),
});
const ResponseSchema = z.object({
  variants: z.array(VariantSchema),
});

export type GenerateInput = {
  baseCaption: string;
  title?: string;
  notes?: string;
  platforms: Platform[];
};

function systemPrompt(platforms: Platform[]): string {
  const guidance = platforms
    .map((p) => `- ${p}: ${PLATFORM_GUIDANCE[p]}`)
    .join("\n");
  return [
    "You are an editor producing platform-tailored social media captions for a single brand operator.",
    "Goals: be natural, on-brand, no marketing-speak, no emoji spam, no hallucinated claims.",
    "Adapt tone and length to each platform per the rules below.",
    "Separate hashtags from the caption body — return them in the dedicated 'hashtags' field as space-separated tokens including the #.",
    "",
    "Platform rules:",
    guidance,
    "",
    'Output strict JSON of the shape: {"variants":[{"platform":"...","caption":"...","hashtags":"..."}, ...]}.',
    "One entry per requested platform, in the same order. No prose outside the JSON.",
  ].join("\n");
}

function userPrompt(input: GenerateInput): string {
  const parts: string[] = [];
  if (input.title) parts.push(`Title: ${input.title}`);
  parts.push(`Base caption / idea:\n${input.baseCaption}`);
  if (input.notes) parts.push(`Operator notes: ${input.notes}`);
  parts.push(`Target platforms: ${input.platforms.join(", ")}`);
  return parts.join("\n\n");
}

type AnthropicResponse = {
  content: Array<{ type: string; text?: string }>;
};

async function callAnthropic(
  cfg: ResolvedAiConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await postJson<AnthropicResponse>(
    "https://api.anthropic.com/v1/messages",
    {
      model: cfg.model,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    },
    {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
  );
  const block = res.content?.find((c) => c.type === "text");
  if (!block?.text) throw new Error("anthropic: empty response");
  return block.text;
}

type OpenAIResponse = {
  choices: Array<{ message: { content: string | null } }>;
};

async function callOpenAI(
  cfg: ResolvedAiConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await postJson<OpenAIResponse>(
    "https://api.openai.com/v1/chat/completions",
    {
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    },
    {
      authorization: `Bearer ${cfg.apiKey}`,
    },
  );
  const text = res.choices?.[0]?.message?.content;
  if (!text) throw new Error("openai: empty response");
  return text;
}

function extractJson(raw: string): unknown {
  // Try direct parse first.
  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }
  // Strip ```json fences if present.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  // Last resort: find outermost {...}.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {
      // fall through
    }
  }
  throw new Error("ai: response was not valid JSON");
}

export async function generatePlatformCaptions(
  input: GenerateInput,
): Promise<CaptionVariant[]> {
  if (input.platforms.length === 0) return [];
  const cfg = await getAiConfig();
  if (!cfg) {
    throw new Error(
      "AI is not configured. Set an API key in Settings → AI captions, or in .env",
    );
  }
  const system = systemPrompt(input.platforms);
  const user = userPrompt(input);

  log.info(
    { provider: cfg.provider, model: cfg.model, platforms: input.platforms },
    "ai generate request",
  );

  const raw =
    cfg.provider === "anthropic"
      ? await callAnthropic(cfg, system, user)
      : await callOpenAI(cfg, system, user);

  const parsed = ResponseSchema.parse(extractJson(raw));
  // Make sure we return variants in the requested order.
  const byPlatform = new Map(parsed.variants.map((v) => [v.platform, v]));
  return input.platforms.map((p) => {
    const v = byPlatform.get(p);
    if (!v) {
      return { platform: p, caption: input.baseCaption, hashtags: "" };
    }
    return v;
  });
}

export async function pingAi(): Promise<{ ok: true; model: string }> {
  const cfg = await getAiConfig();
  if (!cfg) throw new Error("AI not configured");
  // Cheapest valid request: one-token completion.
  if (cfg.provider === "anthropic") {
    await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        model: cfg.model,
        max_tokens: 4,
        messages: [{ role: "user", content: "ping" }],
      },
      {
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
    );
  } else {
    await postJson(
      "https://api.openai.com/v1/chat/completions",
      {
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4,
      },
      { authorization: `Bearer ${cfg.apiKey}` },
    );
  }
  return { ok: true, model: cfg.model };
}
