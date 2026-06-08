import { z } from "zod";
import {
  createSessionCookie,
  isPasswordSet,
  setPassword,
} from "@/lib/auth";
import { fail, failFromException, ok } from "@/lib/api";
import { logger } from "@/lib/logger";

const Body = z.object({ password: z.string().min(8) });

export async function POST(req: Request): Promise<Response> {
  try {
    if (await isPasswordSet()) {
      return fail("Password already set", 409);
    }
    const json = await req.json();
    const { password } = Body.parse(json);
    await setPassword(password);
    await createSessionCookie();
    logger.info("password set on first run; session created");
    return ok({ ok: true });
  } catch (e) {
    return failFromException(e);
  }
}
