import { type NextRequest } from "next/server";
import { ok, fail, failFromException } from "@/lib/api";
import { prisma } from "@/lib/db";
import { publishNow } from "@/lib/workers/scheduler";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const pp = await prisma.platformPost.findUnique({ where: { id } });
    if (!pp) return fail("Not found", 404);
    if (pp.status === "PUBLISHED") return fail("Already published", 409);
    if (pp.status === "PUBLISHING") return fail("Already in flight", 409);

    // Don't block the HTTP request on the publish — fire it and let the worker
    // record the result. The UI polls the row's status.
    void publishNow(id).catch(() => {});
    return ok({ id, dispatched: true });
  } catch (e) {
    return failFromException(e);
  }
}
