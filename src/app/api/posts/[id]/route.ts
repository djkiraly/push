import { type NextRequest } from "next/server";
import { ok, fail, failFromException } from "@/lib/api";
import { UpdatePostSchema } from "@/lib/validations/posts";
import { deletePost, getPost, updatePost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const post = await getPost(id);
    if (!post) return fail("Not found", 404);
    return ok(post);
  } catch (e) {
    return failFromException(e);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = UpdatePostSchema.parse(await req.json());
    const updated = await updatePost(id, body);
    return ok(updated);
  } catch (e) {
    return failFromException(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const removed = await deletePost(id);
    if (!removed) return fail("Not found", 404);
    return ok({ id });
  } catch (e) {
    return failFromException(e);
  }
}
