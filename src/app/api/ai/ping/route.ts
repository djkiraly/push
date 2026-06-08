import { ok, failFromException } from "@/lib/api";
import { pingAi } from "@/lib/ai/generate";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return ok(await pingAi());
  } catch (e) {
    return failFromException(e);
  }
}
