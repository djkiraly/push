import { type NextRequest } from "next/server";
import { ok, fail, failFromException } from "@/lib/api";
import { GenerateRequestSchema } from "@/lib/validations/posts";
import { getPost } from "@/lib/posts";
import { generatePlatformCaptions } from "@/lib/ai/generate";
import type { Platform } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = GenerateRequestSchema.parse(await req.json().catch(() => ({})));
    const post = await getPost(id);
    if (!post) return fail("Not found", 404);

    const platforms: Platform[] =
      body.platforms ??
      Array.from(new Set(post.platformPosts.map((v) => v.platform)));

    if (platforms.length === 0) {
      return fail("Add at least one platform variant before generating", 400);
    }

    const variants = await generatePlatformCaptions({
      baseCaption: body.baseCaption ?? post.baseCaption,
      title: post.title,
      notes: post.notes ?? undefined,
      platforms,
    });
    return ok({ variants });
  } catch (e) {
    return failFromException(e);
  }
}
