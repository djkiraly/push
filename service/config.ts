import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_SCRIPT = path.join(PROJECT_ROOT, "dist", "server.js");
const SERVICE_NAME = "PushScheduler";
const SERVICE_DESCRIPTION =
  "Push — local-first social media scheduler (Facebook, Instagram, TikTok, YouTube).";

export const serviceConfig = {
  name: SERVICE_NAME,
  description: SERVICE_DESCRIPTION,
  script: SERVER_SCRIPT,
  projectRoot: PROJECT_ROOT,
  // The service runtime needs to know it's running under the service so the
  // logger can mirror to Windows Event Log instead of (only) stdout.
  envExtras: [
    { name: "PUSH_SERVICE_MODE", value: "1" },
    { name: "NODE_ENV", value: "production" },
  ],
} as const;
