import { z } from "zod";
import { type NextRequest } from "next/server";
import { ok, fail, failFromException } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  caption: z.string().min(1).optional(),
  hashtags: z.string().optional().nullable(),
  scheduledFor: z.string().datetime({ offset: true }).optional().nullable(),
  status: z
    .enum(["DRAFT", "SCHEDULED", "CANCELLED"])
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = PatchSchema.parse(await req.json());

    const existing = await prisma.platformPost.findUnique({ where: { id } });
    if (!existing) return fail("Not found", 404);
    if (existing.status === "PUBLISHED" || existing.status === "PUBLISHING") {
      return fail("Cannot edit a post that has been or is being published", 409);
    }

    const data: Record<string, unknown> = {};
    if (body.caption !== undefined) data.caption = body.caption;
    if (body.hashtags !== undefined) data.hashtags = body.hashtags;
    if (body.scheduledFor !== undefined) {
      data.scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
    }
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "SCHEDULED") {
        data.attempts = 0;
        data.lastError = null;
        data.lockedAt = null;
      }
    }

    const updated = await prisma.platformPost.update({ where: { id }, data });
    return ok(updated);
  } catch (e) {
    return failFromException(e);
  }
}
