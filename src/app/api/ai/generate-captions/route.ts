import { z } from "zod";
import { type NextRequest } from "next/server";
import { ok, failFromException } from "@/lib/api";
import { generatePlatformCaptions } from "@/lib/ai/generate";

export const dynamic = "force-dynamic";

const Body = z.object({
  baseCaption: z.string().min(1),
  title: z.string().optional(),
  notes: z.string().optional(),
  platforms: z
    .array(z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE"]))
    .min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const variants = await generatePlatformCaptions(body);
    return ok({ variants });
  } catch (e) {
    return failFromException(e);
  }
}
