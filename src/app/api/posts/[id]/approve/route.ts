import { type NextRequest } from "next/server";
import { ok, fail, failFromException } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: { platformPosts: true },
    });
    if (!post) return fail("Not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id }, data: { status: "APPROVED" } });
      // Move DRAFT variants with a schedule into SCHEDULED. Drafts without
      // a schedule remain DRAFT until the operator sets a time.
      for (const v of post.platformPosts) {
        if (v.status === "DRAFT" && v.scheduledFor) {
          await tx.platformPost.update({
            where: { id: v.id },
            data: { status: "SCHEDULED", attempts: 0, lastError: null },
          });
        }
      }
    });

    return ok({ id });
  } catch (e) {
    return failFromException(e);
  }
}
