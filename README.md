# Push

Local-first social media scheduler that runs on your Windows workstation. Schedules and publishes to Facebook Pages, Instagram (Business/Creator), TikTok, and YouTube Shorts using official APIs only. Single-user, no cloud, no SaaS.

## Status

**M1–M7 complete.** Foundations, OAuth (FB/IG/TikTok/YouTube), media library + watch folder, AI-assisted compose, approvals + scheduler with retry/backoff, hourly analytics polling, and Windows service packaging.

## Prerequisites

- Windows 11 (or any platform during dev — service install is Windows-only)
- Node.js 20 LTS
- A 32-byte random secret for `PUSH_MASTER_KEY` — generate with:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## First-time setup

```powershell
# 1. Install deps
npm install

# 2. Configure env
copy .env.example .env
# then edit .env and paste your generated PUSH_MASTER_KEY

# 3. Create the SQLite database
npx prisma migrate dev --name init

# 4. Run in dev mode
npm run dev
```

Open http://127.0.0.1:7531 — first visit redirects to `/setup` so you can choose a UI password. After that, sign in at `/login`.

## Environment

See `.env.example` for the full list. The only required values for M1 are:

- `PUSH_MASTER_KEY` — 64 hex chars; encrypts OAuth tokens at rest and signs the session cookie.
- `DATABASE_URL` — defaults to `file:./data/push.db`.
- `PUSH_PORT` / `PUSH_HOST` — bound to `127.0.0.1:7531` by default. **Do not bind to `0.0.0.0`.**

OAuth credentials (Meta, TikTok, Google) are not needed until M2.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the custom server with hot reload (`tsx watch server.ts`) |
| `npm run build` | Build Next + compile `server.ts` to `dist/server.js` |
| `npm start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` across the project |
| `npm run lint` | ESLint via `next lint` |
| `npm test` | Vitest |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:studio` | Open Prisma Studio against `data/push.db` |
| `npm run service:install` | Register Windows service via `node-windows` (admin shell required) |
| `npm run service:uninstall` | Unregister the Windows service (admin shell required) |
| `npm run service:start` / `:stop` | `net start` / `net stop` shortcuts for the `PushScheduler` service |

## Running as a Windows service

After dev-testing, install Push as an auto-starting Windows service:

```powershell
# 1. Build the production bundle the service will run.
npm run build

# 2. Open an *Administrator* PowerShell and install:
npm run service:install
```

The service installs under the name **PushScheduler** and starts immediately. From then on:

- It auto-starts on Windows boot. Manage it from `services.msc` or via `net start PushScheduler` / `net stop PushScheduler`.
- Logs continue to roll daily in `./logs/push.log`. Warnings and errors are also mirrored to the Windows Event Log under source **PushScheduler** so you can correlate failures in Event Viewer.
- To reinstall after pulling new code: `npm run service:stop && npm run build && npm run service:start`. For config changes that require a re-register, run `service:uninstall` then `service:install`.

The service runs the compiled `dist/server.js` with `NODE_ENV=production` and `PUSH_SERVICE_MODE=1`. `.env` is loaded at startup as in dev. The HTTP listener still binds to `127.0.0.1` only — to reach the UI from a different machine, set up a tunnel; never bind directly to a public interface.

## Architecture (one-paragraph)

The Windows service wraps a single Node process. That process is a custom Next.js server (`server.ts`) that hosts the UI + API and runs three in-process workers — a 30-second-tick scheduler, a chokidar watch-folder watcher, and an hourly analytics poller — all backed by SQLite via Prisma. OAuth tokens are encrypted with AES-256-GCM keyed off `PUSH_MASTER_KEY`. The HTTP listener binds to `127.0.0.1` only.

For more detail, see `CLAUDE.md`.

## Non-goals

No multi-user. No team features. No cloud DB. No Docker. No mobile app. No DM management. No automatic boosting. Push is a personal back-office tool; scope creep is the enemy.
