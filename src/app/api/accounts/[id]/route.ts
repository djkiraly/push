import { z } from "zod";
import { type NextRequest } from "next/server";
import { ok, fail, failFromException } from "@/lib/api";
import { deleteAccount, getAccount, setAccountEnabled } from "@/lib/platforms/accounts";

const PatchSchema = z.object({ enabled: z.boolean() });

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const acct = await getAccount(id);
    if (!acct) return fail("Not found", 404);
    await deleteAccount(id);
    return ok({ id });
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
    const body = PatchSchema.parse(await req.json());
    const acct = await getAccount(id);
    if (!acct) return fail("Not found", 404);
    await setAccountEnabled(id, body.enabled);
    return ok({ id, enabled: body.enabled });
  } catch (e) {
    return failFromException(e);
  }
}
