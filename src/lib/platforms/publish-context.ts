import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type {
  Account,
  MediaAsset,
  PlatformPost,
  Post,
  PostMedia,
} from "@prisma/client";

export type LoadedPlatformPost = PlatformPost & {
  account: Account;
  post: Post & {
    media: Array<PostMedia & { mediaAsset: MediaAsset }>;
  };
};

export async function loadPlatformPost(id: string): Promise<LoadedPlatformPost | null> {
  const pp = await prisma.platformPost.findUnique({
    where: { id },
    include: {
      account: true,
      post: {
        include: {
          media: {
            orderBy: { position: "asc" },
            include: { mediaAsset: true },
          },
        },
      },
    },
  });
  return pp;
}

export function composeText(pp: PlatformPost): string {
  if (!pp.hashtags || pp.hashtags.trim().length === 0) return pp.caption;
  return `${pp.caption.trimEnd()}\n\n${pp.hashtags.trim()}`;
}

export function publicMediaUrl(assetId: string): string {
  const base = env().PUSH_PUBLIC_URL;
  if (!base) {
    throw new Error(
      "PUSH_PUBLIC_URL is not set. Instagram needs a reachable media URL — point this at a tunnel (e.g. ngrok) of your Push instance.",
    );
  }
  return `${base.replace(/\/$/, "")}/api/media/${assetId}/file`;
}

export function assertImage(asset: MediaAsset): void {
  if (!asset.mimeType.startsWith("image/")) {
    throw new Error(`expected image, got ${asset.mimeType}`);
  }
}
export function assertVideo(asset: MediaAsset): void {
  if (!asset.mimeType.startsWith("video/")) {
    throw new Error(`expected video, got ${asset.mimeType}`);
  }
}
