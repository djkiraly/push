// Shared test helpers for seeding and resetting the throwaway SQLite DB.
// Imports the real Prisma singleton — DATABASE_URL is already pointed at the
// test file by setup-db.ts.
import type { PlatformPost, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Wipe every table in FK-safe order. Call in beforeEach for isolation. */
export async function resetDb(): Promise<void> {
  await prisma.platformPostEvent.deleteMany();
  await prisma.metricSnapshot.deleteMany();
  await prisma.platformPost.deleteMany();
  await prisma.postMedia.deleteMany();
  await prisma.post.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.account.deleteMany();
  await prisma.setting.deleteMany();
}

export interface Parents {
  accountId: string;
  postId: string;
}

/** Create the Account + Post a PlatformPost needs to satisfy its FKs. */
export async function seedParents(): Promise<Parents> {
  const account = await prisma.account.create({
    data: {
      platform: "FACEBOOK",
      displayName: "Test Page",
      externalId: "ext-fb",
      accessToken: "v1.encrypted.token",
    },
  });
  const post = await prisma.post.create({
    data: { title: "Test post", baseCaption: "caption", contentType: "IMAGE" },
  });
  return { accountId: account.id, postId: post.id };
}

/**
 * Create a PlatformPost. Defaults to a SCHEDULED row whose scheduledFor is in
 * the past (i.e. due now). Override any field.
 */
export async function createPlatformPost(
  parents: Parents,
  overrides: Partial<Prisma.PlatformPostUncheckedCreateInput> = {},
): Promise<PlatformPost> {
  return prisma.platformPost.create({
    data: {
      postId: parents.postId,
      accountId: parents.accountId,
      platform: "FACEBOOK",
      caption: "hello world",
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 60_000),
      ...overrides,
    },
  });
}

export async function getPlatformPost(id: string): Promise<PlatformPost | null> {
  return prisma.platformPost.findUnique({ where: { id } });
}

export async function eventTypes(platformPostId: string): Promise<string[]> {
  const events = await prisma.platformPostEvent.findMany({
    where: { platformPostId },
    orderBy: { createdAt: "asc" },
    select: { eventType: true },
  });
  return events.map((e) => e.eventType);
}
