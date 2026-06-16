// Custom Next.js server.
// Hosts the UI/API and bootstraps in-process workers (scheduler, watch
// folder, analytics poller). Bound to 127.0.0.1 only — this process is
// never reachable from outside the operator's workstation.

import "dotenv/config";
import http from "node:http";
import next from "next";
import { env } from "./src/lib/env";
import { logger } from "./src/lib/logger";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./src/lib/auth-edge";
import { isPublicPath } from "./src/lib/public-paths";
import { startScheduler, stopScheduler } from "./src/lib/workers/scheduler";
import { startWatchFolder, stopWatchFolder } from "./src/lib/workers/watch-folder";
import {
  startAnalyticsPoller,
  stopAnalyticsPoller,
} from "./src/lib/workers/analytics-poller";

// Minimal cookie reader for the raw http request (no Next helpers available at
// this layer). Returns the first value matching `name`, URL-decoded.
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const cfg = env();
  const dev = cfg.NODE_ENV !== "production";

  const app = next({ dev, hostname: cfg.PUSH_HOST, port: cfg.PUSH_PORT });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        // Auth gate. Next middleware is bypassed under a custom server, so we
        // enforce the session here for non-public API routes (pages are guarded
        // by their server-component layouts). Without this, every /api/* route
        // would be reachable unauthenticated.
        const pathname = (req.url ?? "/").split("?", 1)[0]!;
        if (pathname.startsWith("/api/") && !isPublicPath(pathname)) {
          const token = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
          const session = token ? await verifySessionToken(token) : null;
          if (!session) {
            res.statusCode = 401;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
          }
        }
        await handle(req, res);
      } catch (err) {
        logger.error({ err, url: req.url }, "request handler crashed");
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      }
    })();
  });

  server.listen(cfg.PUSH_PORT, cfg.PUSH_HOST, () => {
    logger.info(
      { host: cfg.PUSH_HOST, port: cfg.PUSH_PORT, mode: dev ? "dev" : "prod" },
      "Push HTTP server listening",
    );
  });

  // Workers are started after the HTTP server is up so a failing worker
  // doesn't prevent the operator from reaching the UI to fix it.
  startScheduler();
  void startWatchFolder().catch((err) => {
    logger.error({ err }, "watch folder failed to start");
  });
  startAnalyticsPoller();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "shutting down");
    void stopScheduler();
    void stopWatchFolder();
    stopAnalyticsPoller();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
  });
}

main().catch((err) => {
  // Logger may not have initialized if env validation failed — fall back to console.
  // eslint-disable-next-line no-console
  console.error("Fatal: failed to start Push server\n", err);
  process.exit(1);
});
