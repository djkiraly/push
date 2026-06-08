import { isPasswordSet, readSessionFromCookie } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function GET(): Promise<Response> {
  return ok({
    passwordSet: await isPasswordSet(),
    authenticated: (await readSessionFromCookie()) !== null,
  });
}
