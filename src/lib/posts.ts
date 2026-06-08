import { prisma } from "@/lib/db";
import type { CreatePostInput, UpdatePostInput } from "@/lib/validations/posts";

export async function createPost(input: CreatePostInput) {
  const accounts = await prisma.account.findMany({
    where: { id: { in: input.variants.map((v) => v.accountId) } },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const missing = input.variants.filter((v) => !accountById.has(v.accountId));
  if (missing.length > 0) {
    throw new Error(`Unknown accountId(s): ${missing.map((m) => m.accountId).join(", ")}`);
  }

  return prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        title: input.title,
        baseCaption: input.baseCaption,
        contentType: input.contentType,
        notes: input.notes ?? null,
        status: input.status ?? "DRAFT",
      },
    });

    await tx.postMedia.createMany({
      data: input.mediaIds.map((mediaAssetId, position) => ({
        postId: post.id,
        mediaAssetId,
        position,
      })),
    });

    for (const v of input.variants) {
      const account = accountById.get(v.accountId);
      if (!account) continue;
      await tx.platformPost.create({
        data: {
          postId: post.id,
          accountId: v.accountId,
          platform: account.platform,
          caption: v.caption,
          hashtags: v.hashtags ?? null,
          scheduledFor: v.scheduledFor ? new Date(v.scheduledFor) : null,
          status:
            v.status ??
            (v.scheduledFor ? "SCHEDULED" : "DRAFT"),
        },
      });
    }

    return tx.post.findUnique({
      where: { id: post.id },
      include: {
        media: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
        platformPosts: { include: { account: true } },
      },
    });
  });
}

export async function updatePost(id: string, input: UpdatePostInput) {
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) throw new Error("Post not found");

  return prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id },
      data: {
        title: input.title ?? undefined,
        baseCaption: input.baseCaption ?? undefined,
        contentType: input.contentType ?? undefined,
        notes: input.notes === undefined ? undefined : input.notes,
        status: input.status ?? undefined,
      },
    });

    if (input.mediaIds) {
      await tx.postMedia.deleteMany({ where: { postId: id } });
      await tx.postMedia.createMany({
        data: input.mediaIds.map((mediaAssetId, position) => ({
          postId: id,
          mediaAssetId,
          position,
        })),
      });
    }

    if (input.variants) {
      const accounts = await tx.account.findMany({
        where: { id: { in: input.variants.map((v) => v.accountId) } },
      });
      const accountById = new Map(accounts.map((a) => [a.id, a]));
      // Replace variants wholesale; published rows shouldn't really be edited
      // post-publish but caller is responsible for filtering.
      await tx.platformPost.deleteMany({ where: { postId: id } });
      for (const v of input.variants) {
        const account = accountById.get(v.accountId);
        if (!account) continue;
        await tx.platformPost.create({
          data: {
            postId: id,
            accountId: v.accountId,
            platform: account.platform,
            caption: v.caption,
            hashtags: v.hashtags ?? null,
            scheduledFor: v.scheduledFor ? new Date(v.scheduledFor) : null,
            status: v.status ?? (v.scheduledFor ? "SCHEDULED" : "DRAFT"),
          },
        });
      }
    }

    return tx.post.findUnique({
      where: { id },
      include: {
        media: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
        platformPosts: { include: { account: true } },
      },
    });
  });
}

export async function listPosts() {
  return prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      media: {
        take: 1,
        orderBy: { position: "asc" },
        include: { mediaAsset: true },
      },
      platformPosts: {
        select: {
          id: true,
          platform: true,
          status: true,
          scheduledFor: true,
          publishedAt: true,
        },
      },
    },
  });
}

export async function getPost(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: {
      media: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
      platformPosts: {
        include: { account: true },
        orderBy: { platform: "asc" },
      },
    },
  });
}

export async function deletePost(id: string): Promise<boolean> {
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.post.delete({ where: { id } });
  return true;
}
