import { ok, failFromException } from "@/lib/api";
import { pollAnalyticsOnce } from "@/lib/workers/analytics-poller";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await pollAnalyticsOnce();
    return ok(result);
  } catch (e) {
    return failFromException(e);
  }
}
