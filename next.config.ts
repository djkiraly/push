import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  serverExternalPackages: [
    "argon2",
    "better-sqlite3",
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "sharp",
    "fluent-ffmpeg",
    "node-windows",
  ],
  // The parent D:\Projects\ has its own package-lock.json which Turbopack
  // would otherwise pick as the workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default config;
