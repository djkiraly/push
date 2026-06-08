import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { platformLabel } from "@/lib/platforms/accounts";
import { ApprovalsList, type ApprovalPost } from "./approvals-list";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage(): Promise<React.ReactElement> {
  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
        { platformPosts: { some: { status: { in: ["FAILED", "SCHEDULED"] } } } },
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

  const list: ApprovalPost[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    baseCaption: p.baseCaption,
    contentType: p.contentType,
    status: p.status,
    updatedAt: p.updatedAt.toISOString(),
    coverMediaId: p.media[0]?.mediaAssetId ?? null,
    variants: p.platformPosts.map((v) => ({
      id: v.id,
      platform: v.platform,
      platformLabel: platformLabel(v.platform),
      status: v.status,
      caption: v.caption,
      hashtags: v.hashtags,
      scheduledFor: v.scheduledFor ? v.scheduledFor.toISOString() : null,
      publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
      attempts: v.attempts,
      lastError: v.lastError,
      externalPermalink: v.externalPermalink,
      accountName: v.account.displayName,
    })),
  }));

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Review, schedule, and intervene on platform posts."
      />
      {list.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing to review</CardTitle>
            <CardDescription>
              Drafts, scheduled, and failed posts will surface here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ApprovalsList posts={list} />
      )}
    </>
  );
}
