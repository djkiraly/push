import { z } from "zod";
import { type NextRequest } from "next/server";
import { ok, failFromException } from "@/lib/api";
import { setSetting, deleteSetting, SettingKeys } from "@/lib/settings";
import {
  getAllProviderConfigs,
  toStatus,
  type ProviderKey,
} from "@/lib/platforms/oauth-config";

export const dynamic = "force-dynamic";

const PutSchema = z.object({
  provider: z.enum(["meta", "tiktok", "google"]),
  clientId: z.string().optional().nullable(),
  clientSecret: z.string().optional().nullable(),
});

function keysFor(provider: ProviderKey): {
  idKey: string;
  secretKey: string;
} {
  switch (provider) {
    case "meta":
      return {
        idKey: SettingKeys.metaAppId,
        secretKey: SettingKeys.metaAppSecret,
      };
    case "tiktok":
      return {
        idKey: SettingKeys.tiktokClientKey,
        secretKey: SettingKeys.tiktokClientSecret,
      };
    case "google":
      return {
        idKey: SettingKeys.googleClientId,
        secretKey: SettingKeys.googleClientSecret,
      };
  }
}

export async function GET() {
  try {
    const all = await getAllProviderConfigs();
    return ok({
      meta: toStatus(all.meta),
      tiktok: toStatus(all.tiktok),
      google: toStatus(all.google),
    });
  } catch (e) {
    return failFromException(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = PutSchema.parse(await req.json());
    const { idKey, secretKey } = keysFor(body.provider);

    if (body.clientId === null) {
      await deleteSetting(idKey);
    } else if (body.clientId && body.clientId.trim().length > 0) {
      await setSetting(idKey, body.clientId.trim());
    }

    if (body.clientSecret === null) {
      await deleteSetting(secretKey);
    } else if (body.clientSecret && body.clientSecret.trim().length > 0) {
      await setSetting(secretKey, body.clientSecret.trim());
    }

    const all = await getAllProviderConfigs();
    return ok(toStatus(all[body.provider]));
  } catch (e) {
    return failFromException(e);
  }
}
