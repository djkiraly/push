import { z } from "zod";
import { createSessionCookie, verifyPassword } from "@/lib/auth";
import { fail, failFromException, ok } from "@/lib/api";

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: Request): Promise<Response> {
  try {
    const json = await req.json();
    const { password } = Body.parse(json);
    if (!(await verifyPassword(password))) {
      return fail("Invalid password", 401);
    }
    await createSessionCookie();
    return ok({ ok: true });
  } catch (e) {
    return failFromException(e);
  }
}
