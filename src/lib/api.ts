import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Standard API response shape: { data } | { error, details? }

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function fail(
  error: string,
  status = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json({ error, details }, { status });
}

export function failFromException(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    return fail("Validation failed", 400, e.flatten());
  }
  if (e instanceof Error) {
    return fail(e.message, 500);
  }
  return fail("Unknown error", 500);
}
