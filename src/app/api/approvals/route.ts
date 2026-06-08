import { ok, failFromException } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
          { platformPosts: { some: { status: "FAILED" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        media: {
          take: 1,
          orderBy: { position: "asc" },
          include: { mediaAsset: true },
        },
        platformPosts: {
          include: {
            account: { select: { id: true, displayName: true, platform: true } },
          },
          orderBy: { platform: "asc" },
        },
      },
    });

    return ok(
      posts.map((p) => ({
        id: p.id,
        title: p.title,
        baseCaption: p.baseCaption,
        contentType: p.contentType,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        coverMediaId: p.media[0]?.mediaAssetId ?? null,
        variants: p.platformPosts.map((v) => ({
          id: v.id,
          platform: v.platform,
          status: v.status,
          caption: v.caption,
          hashtags: v.hashtags,
          scheduledFor: v.scheduledFor,
          publishedAt: v.publishedAt,
          attempts: v.attempts,
          lastError: v.lastError,
          externalPermalink: v.externalPermalink,
          account: v.account,
        })),
      })),
    );
  } catch (e) {
    return failFromException(e);
  }
}
