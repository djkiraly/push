import { z } from "zod";
import { type NextRequest } from "next/server";
import { ok, failFromException } from "@/lib/api";
import { setSetting, SettingKeys, deleteSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const Body = z.object({
  provider: z.enum(["anthropic", "openai"]).optional(),
  model: z.string().optional(),
  anthropicKey: z.string().optional().nullable(),
  openaiKey: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());

    if (body.provider) await setSetting(SettingKeys.aiProvider, body.provider);
    if (body.model) await setSetting(SettingKeys.aiModel, body.model);

    if (body.anthropicKey === null) {
      await deleteSetting(SettingKeys.aiAnthropicKey);
    } else if (body.anthropicKey && body.anthropicKey.length > 0) {
      await setSetting(SettingKeys.aiAnthropicKey, body.anthropicKey);
    }

    if (body.openaiKey === null) {
      await deleteSetting(SettingKeys.aiOpenaiKey);
    } else if (body.openaiKey && body.openaiKey.length > 0) {
      await setSetting(SettingKeys.aiOpenaiKey, body.openaiKey);
    }

    return ok({ saved: true });
  } catch (e) {
    return failFromException(e);
  }
}
