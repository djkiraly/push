import { z } from "zod";

const Schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PUSH_PORT: z.coerce.number().int().min(1).max(65535).default(7531),
  PUSH_HOST: z.string().default("127.0.0.1"),
  PUSH_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "PUSH_MASTER_KEY must be 64 hex chars (32 bytes)"),
  DATABASE_URL: z.string().min(1),

  // Optional public URL of this Push instance, used to give Instagram a
  // reachable image_url/video_url. If unset, IG photo posts cannot publish.
  PUSH_PUBLIC_URL: z.string().url().optional(),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().url().optional(),

  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().url().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof Schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
