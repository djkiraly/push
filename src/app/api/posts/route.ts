import { type NextRequest } from "next/server";
import { ok, failFromException } from "@/lib/api";
import { CreatePostSchema } from "@/lib/validations/posts";
import { createPost, listPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await listPosts();
    return ok(
      posts.map((p) => ({
        id: p.id,
        title: p.title,
        contentType: p.contentType,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        thumbMediaId: p.media[0]?.mediaAssetId ?? null,
        variants: p.platformPosts.map((v) => ({
          id: v.id,
          platform: v.platform,
          status: v.status,
          scheduledFor: v.scheduledFor,
          publishedAt: v.publishedAt,
        })),
      })),
    );
  } catch (e) {
    return failFromException(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreatePostSchema.parse(await req.json());
    const created = await createPost(body);
    return ok(created, { status: 201 });
  } catch (e) {
    return failFromException(e);
  }
}
