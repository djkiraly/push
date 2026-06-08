import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import type { Platform } from "@prisma/client";
import { platformLabel } from "@/lib/platforms/accounts";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

type PlatformTotals = {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

const ZERO: PlatformTotals = {
  posts: 0,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
};

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE"];

function fmtInt(n: number): string {
  return n.toLocaleString();
}

export default async function AnalyticsPage(): Promise<React.ReactElement> {
  const [published, topRows] = await Promise.all([
    prisma.platformPost.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        platform: true,
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
    }),
    prisma.platformPost.findMany({
      where: { status: "PUBLISHED" },
      take: 100,
      include: {
        post: { select: { title: true } },
        account: { select: { displayName: true } },
        metrics: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const totals: Record<Platform, PlatformTotals> = {
    FACEBOOK: { ...ZERO },
    INSTAGRAM: { ...ZERO },
    TIKTOK: { ...ZERO },
    YOUTUBE: { ...ZERO },
  };
  let lastSnapshotAt: Date | null = null;

  for (const p of published) {
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

  const ranked = [...topRows]
    .map((r) => ({
      r,
      score:
        (r.metrics[0]?.views ?? 0) +
        (r.metrics[0]?.likes ?? 0) * 5 +
        (r.metrics[0]?.comments ?? 0) * 10,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((x) => x.r);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Metrics snapshot every hour for posts published in the last 30 days."
        actions={
          <RefreshButton
            lastSnapshotLabel={
              lastSnapshotAt
                ? `Last snapshot ${lastSnapshotAt.toLocaleString()}`
                : "No snapshots yet"
            }
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORMS.map((p) => {
          const t = totals[p];
          return (
            <Card key={p}>
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                {platformLabel(p)}
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">
                {fmtInt(t.views)}
              </div>
              <div className="mt-1 text-xs text-zinc-500">total views</div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-[11px] text-zinc-400">
                <span>{fmtInt(t.likes)} likes</span>
                <span>{fmtInt(t.comments)} comments</span>
                <span>{fmtInt(t.shares)} shares</span>
              </div>
              <div className="mt-2 text-[10px] text-zinc-600">
                {t.posts} post{t.posts === 1 ? "" : "s"}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top posts</CardTitle>
          <CardDescription>
            Ranked by views + 5×likes + 10×comments (most recent snapshot).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No metrics yet — they fill in once posts publish and the poller
              runs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr className="border-b border-zinc-800">
                    <th className="py-2 text-left font-medium">Post</th>
                    <th className="py-2 text-left font-medium">Platform</th>
                    <th className="py-2 text-right font-medium">Views</th>
                    <th className="py-2 text-right font-medium">Likes</th>
                    <th className="py-2 text-right font-medium">Comments</th>
                    <th className="py-2 text-right font-medium">Shares</th>
                    <th className="py-2 text-right font-medium">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => {
                    const m = r.metrics[0];
                    return (
                      <tr key={r.id} className="border-b border-zinc-900">
                        <td className="py-2 pr-3 align-top">
                          {r.externalPermalink ? (
                            <a
                              href={r.externalPermalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-200 hover:underline"
                            >
                              {r.post.title}
                            </a>
                          ) : (
                            <span className="text-zinc-200">{r.post.title}</span>
                          )}
                          <p className="text-[11px] text-zinc-500">
                            {r.account.displayName}
                          </p>
                        </td>
                        <td className="py-2 pr-3 text-zinc-400">
                          {platformLabel(r.platform)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {m?.views != null ? fmtInt(m.views) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {m?.likes != null ? fmtInt(m.likes) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {m?.comments != null ? fmtInt(m.comments) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {m?.shares != null ? fmtInt(m.shares) : "—"}
                        </td>
                        <td className="py-2 text-right text-xs text-zinc-500">
                          {m?.capturedAt
                            ? m.capturedAt.toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
