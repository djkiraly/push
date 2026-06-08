# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Push** is a single-operator, local-first social media scheduler for the operator of RocketCore.AI. It runs as a Windows service on the operator's workstation and publishes to Facebook Pages, Instagram (Business/Creator), TikTok, and YouTube (Shorts) using official APIs only.

It is **not** a SaaS, **not** multi-tenant, and will never grow team or marketing features. Optimize for simplicity and reliability over generality.

## Locked tech decisions (do not change without operator approval)

- **Runtime:** Node 20 LTS · TypeScript 5 strict (`noUncheckedIndexedAccess`)
- **Framework:** Next.js 16 App Router with a **custom server** (`server.ts`) so the HTTP listener, scheduler, watch-folder worker, and analytics poller all share one process
- **DB:** Prisma 7 + SQLite (via `@prisma/adapter-better-sqlite3`) at `file:./data/push.db` — never Postgres, never cloud. Connection URL lives in `prisma.config.ts`, not `schema.prisma` (Prisma 7 moved it). `PrismaClient` is constructed with `{ adapter }` in `src/lib/db.ts`.
- **UI:** Tailwind CSS 4 (CSS-first config in `globals.css`) + shadcn-style primitives in `src/components/ui/` + `lucide-react` icons; glass-card aesthetic
- **State:** TanStack Query v5 client-side; Server Components by default
- **Validation:** Zod 4 — every API route validates its input
- **Auth:** Single shared password (argon2id) + signed session cookie (jose, HS256) — **no NextAuth**. Cookie name: `push_session`. Listener is bound to `127.0.0.1` only.
- **Encryption:** AES-256-GCM via `src/lib/crypto.ts`, keyed off `PUSH_MASTER_KEY` (64 hex chars in `.env`). Format: `v1.<iv>.<tag>.<ciphertext>` (versioned for future migration).
- **Logger:** pino → daily rotating files in `./logs/` (M7 also writes to Windows Event Log)
- **Workers:** in-process polling — no Redis, no BullMQ, no external queue. Scheduler tick = 30s; analytics poll = 60min.
- **Service wrapper:** `node-windows` (M7)
- **HTTP client:** `undici` for platform calls; `googleapis` only for YouTube
- **Banned:** Postgres, Neon, Redis, BullMQ, Docker, NextAuth, official Meta/TikTok Node SDKs

## Common commands

```powershell
npm run dev              # custom server with hot reload (tsx watch server.ts)
npm run build            # next build && tsc -p tsconfig.server.json
npm start                # production: node dist/server.js
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm test                 # vitest run
npm run test:watch       # vitest in watch mode
npm run prisma:migrate   # prisma migrate dev
npm run prisma:deploy    # prisma migrate deploy (production)
npm run prisma:studio    # browse data/push.db
```

Run a single test: `npx vitest run path/to/file.test.ts -t "test name pattern"`.

## Architecture notes that span multiple files

### One process, three workers
`server.ts` is the entry point. It calls `next({ ... }).prepare()`, attaches the Next handler to an `http.Server` bound to `127.0.0.1:PUSH_PORT`, then starts the workers in `src/lib/workers/`:
- `scheduler.ts` — claims due `PlatformPost` rows every 30s and dispatches to publishers
- `watch-folder.ts` — chokidar watcher on `./media/watch/`
- `analytics-poller.ts` — hourly metric snapshots

Workers are started **after** the HTTP server is listening so that a worker crash on boot doesn't lock the operator out of the UI. All three expose `start*` / `stop*` and shut down cleanly on SIGINT/SIGTERM.

### Post → PlatformPost fan-out
A `Post` is the operator-authored source of truth (one base caption, one set of media). The scheduler doesn't operate on `Post` — it operates on `PlatformPost` rows, one per (post × platform), each with its own tailored caption, hashtags, schedule, status, and external IDs. This split is what makes "schedule the same content to all four platforms with different captions" trivial. Don't collapse it.

### Scheduler claim/lock pattern
Use a transactional `SELECT ... LIMIT 5` of `status='SCHEDULED' AND scheduledFor <= now() AND lockedAt IS NULL`, then `UPDATE` to `status='PUBLISHING', lockedAt=now()` inside the same transaction. This is how we get safe concurrent claims without Redis. On retry: backoff is 5min / 30min / 2hr; after 3 attempts mark `FAILED` and surface in Approvals view.

### Token encryption everywhere
Every OAuth token persisted in the `Account` table goes through `encrypt()` from `src/lib/crypto.ts` first. Wrap every platform API call in a `getValidToken(accountId)` helper (one per platform in `src/lib/platforms/<name>/oauth.ts`) that catches 401, refreshes, persists the new ciphertext, and retries once.

### Settings table is k/v with selective encryption
`src/lib/settings.ts` JSON-encodes every value; keys in the `ENCRYPTED_KEYS` set (e.g. `ai.anthropicKey`, `ai.openaiKey`) are also AES-256-GCM-encrypted. Use `getSetting<T>(key)` / `setSetting(key, value)` — never touch the `setting` table directly from route handlers.

### Auth gate
- `middleware.ts` runs on every non-asset request. Public paths: `/login`, `/setup`, `/api/auth/*`, `/api/oauth/*`, `/api/health`. Everything else requires a valid session.
- First-run UX: `/` → `/setup` if no `ui.passwordHash`, else `/login`, else `/dashboard`.
- The session cookie is HS256 signed with the same 32 bytes as the AES master key — single secret, single process, no rotation needed for v1.

## Build conventions

- Server Components by default; `"use client"` only for interactive forms, drag-drop, react-query.
- Path alias `@/*` → `./src/*`.
- API routes return `ok(data)` or `fail(error, status, details?)` from `src/lib/api.ts`.
- Zod schemas for route bodies live inline in the route file or in `src/lib/validations/` if shared.
- All Prisma access goes through the singleton in `src/lib/db.ts`.
- No `any` without an `// eslint-disable-next-line` and a comment explaining why.
- Vitest for unit tests; cover publisher modules (mocked HTTP) and scheduler claim/retry logic when those land.

## Platform API gotchas (read before touching `src/lib/platforms/`)

- **FB Pages:** OAuth → long-lived user token → fetch **Page access token** via `/me/accounts` (store the Page token, not the user token). No native carousel via API — UI must flag this for FB.
- **Instagram:** Business/Creator account linked to a FB Page is a **hard requirement**. Single image = 2-step container; carousel = 3-step (children with `is_carousel_item=true` → parent with `children=[ids]` → publish); Reels need `media_type=REELS` and **must poll container `status_code` until `FINISHED`** before `media_publish`.
- **TikTok:** Use `FILE_UPLOAD` (chunked) not `PULL_FROM_URL`; use `DIRECT_POST` once app audited (`MEDIA_UPLOAD` pre-audit, surface "finish in app" instruction); pre-audit posts go private — surface this from `/v2/post/publish/creator_info/query/`. Photo posts (single + multi) via `media_type=PHOTO`.
- **YouTube Shorts:** ≤60s + vertical + `#Shorts` in title/description; scopes `youtube.upload` + `youtube.readonly`; refresh tokens long-lived.

## Non-goals (don't propose these)

No multi-user. No roles. No team features. No marketing site. No public pages. No automatic boosting/ads. No DM management. No mobile app. No storing media in the database (filesystem + path reference only).

## Milestone order

M1 Foundations → M2 OAuth → M3 Media → M4 Compose+AI → M5 Approvals+Scheduler → M6 Analytics → M7 Service packaging. Ship M1–M5 as v1; M6–M7 follow. Don't half-do later milestones inside earlier ones.
