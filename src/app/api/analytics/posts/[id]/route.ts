import { type NextRequest } from "next/server";
import { ok, fail, failFromException } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const pp = await prisma.platformPost.findUnique({
      where: { id },
      include: {
        post: { select: { title: true } },
        account: { select: { displayName: true } },
        metrics: { orderBy: { capturedAt: "asc" } },
      },
    });
    if (!pp) return fail("Not found", 404);
    return ok({
      id: pp.id,
      title: pp.post.title,
      platform: pp.platform,
      accountName: pp.account.displayName,
      publishedAt: pp.publishedAt,
      timeseries: pp.metrics.map((m) => ({
        capturedAt: m.capturedAt,
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
      })),
    });
  } catch (e) {
    return failFromException(e);
  }
}
