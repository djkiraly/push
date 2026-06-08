import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { LibraryGrid } from "./library-grid";
import { UploadDropzone } from "./upload-dropzone";

export const dynamic = "force-dynamic";

function kindFromMime(mime: string): "IMAGE" | "VIDEO" | "OTHER" {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "OTHER";
}

export default async function LibraryPage(): Promise<React.ReactElement> {
  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const items = assets.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    bytes: a.bytes,
    width: a.width,
    height: a.height,
    durationMs: a.durationMs,
    source: a.source,
    createdAt: a.createdAt.toISOString(),
    kind: kindFromMime(a.mimeType),
  }));

  return (
    <>
      <PageHeader
        title="Library"
        description="Media available to attach to posts. Drop files here, or into ./media/watch."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>
            Images and short-form videos. Up to 500&nbsp;MB per file.
            Duplicates (by content hash) are detected automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadDropzone />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Library ({items.length})</CardTitle>
          <CardDescription>
            Newest first. Click a tile to preview, or trash to delete from disk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LibraryGrid items={items} />
        </CardContent>
      </Card>
    </>
  );
}
