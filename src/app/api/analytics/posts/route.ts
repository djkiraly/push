import { ok, failFromException } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.platformPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 100,
      include: {
        post: { select: { title: true } },
        account: { select: { displayName: true } },
        metrics: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        title: r.post.title,
        platform: r.platform,
        accountName: r.account.displayName,
        publishedAt: r.publishedAt,
        externalPermalink: r.externalPermalink,
        latest: r.metrics[0]
          ? {
              capturedAt: r.metrics[0].capturedAt,
              views: r.metrics[0].views,
              likes: r.metrics[0].likes,
              comments: r.metrics[0].comments,
              shares: r.metrics[0].shares,
            }
          : null,
      })),
    );
  } catch (e) {
    return failFromException(e);
  }
}
