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
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return fail("Not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id }, data: { status: "ARCHIVED" } });
      // Cancel any not-yet-published variants. Leave PUBLISHED rows alone.
      await tx.platformPost.updateMany({
        where: {
          postId: id,
          status: { in: ["DRAFT", "SCHEDULED", "FAILED"] },
        },
        data: { status: "CANCELLED", lockedAt: null },
      });
    });

    return ok({ id });
  } catch (e) {
    return failFromException(e);
  }
}
