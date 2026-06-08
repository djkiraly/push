import { ok, failFromException } from "@/lib/api";
import { getAiConfigStatus } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getAiConfigStatus());
  } catch (e) {
    return failFromException(e);
  }
}
