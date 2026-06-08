import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { platformLabel } from "@/lib/platforms/accounts";

export const dynamic = "force-dynamic";

export default async function DashboardPage(): Promise<React.ReactElement> {
  const [accounts, drafts, scheduled, failed, published, recent, upcoming] =
    await Promise.all([
      prisma.account.count({ where: { enabled: true } }),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.platformPost.count({ where: { status: "SCHEDULED" } }),
      prisma.platformPost.count({ where: { status: "FAILED" } }),
      prisma.platformPost.count({ where: { status: "PUBLISHED" } }),
      prisma.platformPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 5,
        include: {
          account: { select: { displayName: true, platform: true } },
          post: { select: { title: true } },
        },
      }),
      prisma.platformPost.findMany({
        where: { status: "SCHEDULED", scheduledFor: { not: null } },
        orderBy: { scheduledFor: "asc" },
        take: 5,
        include: {
          account: { select: { displayName: true, platform: true } },
          post: { select: { title: true } },
        },
      }),
    ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What's queued, what's live, what needs you."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Accounts" value={accounts} />
        <Stat label="Drafts" value={drafts} />
        <Stat label="Scheduled" value={scheduled} />
        <Stat label="Failed" value={failed} accent={failed > 0 ? "red" : undefined} />
        <Stat label="Published" value={published} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Next 5 scheduled platform posts.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {upcoming.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-zinc-200">{p.post.title}</p>
                      <p className="text-xs text-zinc-500">
                        {p.account.displayName} ·{" "}
                        {platformLabel(p.account.platform)}
                      </p>
                    </div>
                    <p className="ml-3 shrink-0 text-xs tabular-nums text-zinc-400">
                      {p.scheduledFor?.toLocaleString() ?? ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently published</CardTitle>
            <CardDescription>Last 5 successful publishes.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing published yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {recent.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-zinc-200">{p.post.title}</p>
                      <p className="text-xs text-zinc-500">
                        {p.account.displayName} ·{" "}
                        {platformLabel(p.account.platform)}
                      </p>
                    </div>
                    <p className="ml-3 shrink-0 text-xs tabular-nums text-zinc-400">
                      {p.publishedAt?.toLocaleString() ?? ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "red";
}): React.ReactElement {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div
        className={
          "mt-2 text-3xl font-semibold tabular-nums " +
          (accent === "red" ? "text-red-400" : "")
        }
      >
        {value}
      </div>
    </Card>
  );
}
