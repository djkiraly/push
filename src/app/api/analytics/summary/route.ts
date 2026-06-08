import { ok, failFromException } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PlatformTotals = {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

const ZERO: PlatformTotals = { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 };

export async function GET() {
  try {
    // Latest snapshot per PlatformPost. SQLite can't do DISTINCT ON, so we
    // fetch published posts and their most recent snapshot each.
    const posts = await prisma.platformPost.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        platform: true,
        publishedAt: true,
        metrics: {
          orderBy: { capturedAt: "desc" },
          take: 1,
          select: {
            views: true,
            likes: true,
            comments: true,
            shares: true,
            capturedAt: true,
          },
        },
      },
    });

    const totals: Record<string, PlatformTotals> = {
      FACEBOOK: { ...ZERO },
      INSTAGRAM: { ...ZERO },
      TIKTOK: { ...ZERO },
      YOUTUBE: { ...ZERO },
    };

    let lastSnapshotAt: Date | null = null;

    for (const p of posts) {
      const t = totals[p.platform];
      if (!t) continue;
      t.posts += 1;
      const m = p.metrics[0];
      if (m) {
        t.views += m.views ?? 0;
        t.likes += m.likes ?? 0;
        t.comments += m.comments ?? 0;
        t.shares += m.shares ?? 0;
        if (!lastSnapshotAt || m.capturedAt > lastSnapshotAt) {
          lastSnapshotAt = m.capturedAt;
        }
      }
    }

    return ok({
      totals,
      lastSnapshotAt: lastSnapshotAt ? lastSnapshotAt.toISOString() : null,
    });
  } catch (e) {
    return failFromException(e);
  }
}
