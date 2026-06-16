// Single source of truth for routes reachable without a valid session.
//
// This is consumed by BOTH middleware.ts (Edge runtime) and server.ts (the
// custom Node server). Next.js middleware does NOT run when requests are served
// through a custom server's getRequestHandler(), so server.ts re-applies the
// same gate at the HTTP layer — see the auth guard there. Keep this module
// runtime-neutral (no node:* / next imports) so the Edge middleware can use it.

export const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/api/auth/login",
  "/api/auth/setup",
  "/api/auth/state",
  "/api/health",
];

export const PUBLIC_PREFIXES = ["/api/oauth/"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
