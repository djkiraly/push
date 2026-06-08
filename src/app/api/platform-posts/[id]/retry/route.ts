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
    const pp = await prisma.platformPost.findUnique({ where: { id } });
    if (!pp) return fail("Not found", 404);
    if (pp.status !== "FAILED") return fail("Only FAILED variants can be retried", 409);

    await prisma.platformPost.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        attempts: 0,
        lastError: null,
        lockedAt: null,
        scheduledFor: pp.scheduledFor && pp.scheduledFor > new Date()
          ? pp.scheduledFor
          : new Date(),
      },
    });
    return ok({ id });
  } catch (e) {
    return failFromException(e);
  }
}
