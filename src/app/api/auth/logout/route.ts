import { destroySessionCookie } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST(): Promise<Response> {
  await destroySessionCookie();
  return ok({ ok: true });
}
