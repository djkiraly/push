import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { platformLabel } from "@/lib/platforms/accounts";
import { getAiConfigStatus } from "@/lib/ai/providers";
import { ComposeForm, type ComposeAccount, type ComposeMedia } from "./compose-form";

export const dynamic = "force-dynamic";

export default async function ComposePage(): Promise<React.ReactElement> {
  const [accounts, media, aiStatus] = await Promise.all([
    prisma.account.findMany({
      where: { enabled: true },
      orderBy: [{ platform: "asc" }, { displayName: "asc" }],
    }),
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    getAiConfigStatus(),
  ]);

  const accountList: ComposeAccount[] = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    platformLabel: platformLabel(a.platform),
    displayName: a.displayName,
  }));

  const mediaList: ComposeMedia[] = media.map((m) => ({
    id: m.id,
    filename: m.filename,
    mimeType: m.mimeType,
    bytes: m.bytes,
    width: m.width,
    height: m.height,
    durationMs: m.durationMs,
    kind: m.mimeType.startsWith("image/")
      ? "IMAGE"
      : m.mimeType.startsWith("video/")
        ? "VIDEO"
        : "OTHER",
  }));

  return (
    <>
      <PageHeader
        title="Compose"
        description="Author once, tailor per platform, schedule."
      />
      <ComposeForm
        accounts={accountList}
        media={mediaList}
        aiReady={aiStatus.hasKey}
      />
    </>
  );
}
