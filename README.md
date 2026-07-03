# Inbox AI

A production-ready AI email classifier and shared-inbox triage dashboard. Incoming
Gmail messages are polled on a schedule, classified by OpenAI into a structured
result (category, priority, sentiment, summary, suggested reply, confidence,
assignee), stored in Postgres, and surfaced in a clean SaaS dashboard. Automation
rules can auto-assign, set priority/category, or route emails to teams.

The app **runs and renders locally without any external credentials** — Supabase,
OpenAI, Gmail, and the database each degrade gracefully to deterministic mock /
seeded data.

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** (strict)
- **TailwindCSS v4** + **shadcn/ui** (new-york style, neutral base, CSS variables)
- **Supabase Auth** via `@supabase/ssr`
- **Prisma 7** ORM (Postgres) — client query engine (driver adapter)
- **OpenAI** Node SDK (Responses API, structured JSON output + streaming)
- **Gmail API** via `googleapis`
- **Recharts**, **@tanstack/react-query**, **zod**, **lucide-react**, **next-themes**, **sonner**

## Folder layout

```
/app         App Router routes
  (dashboard)/            Dashboard, Inbox, AI Insights, Automation (Rules), Settings (shared sidebar layout)
  api/cron/poll/          Scheduled Gmail poll + classify pipeline (CRON_SECRET protected)
  api/emails/reply/       Streaming AI suggested-reply endpoint
  auth/callback/          Supabase auth callback
  login, signup           Auth pages
/components   React components (dashboard, inbox, ai-insights, automation, settings, shared, ui/ = shadcn)
/lib          Clients + shared contracts: env.ts, prisma.ts, auth.ts, schemas.ts (zod),
              types.ts, mock-emails.ts, supabase/*
/services     External integrations: openai.ts, gmail.ts (both mockable)
/actions      Server actions ("use server"): emails, rules, tasks
/prisma       schema.prisma + seed.ts
```

### Shared contracts (source of truth)

- **`prisma/schema.prisma`** — data models + enums.
- **`lib/schemas.ts`** — zod enums + `classificationResultSchema` (the exact JSON the
  OpenAI classifier must return) + automation-rule form schemas. Enum string values
  mirror the Prisma enums.
- **`lib/types.ts`** — serializable view models used across server/client.

## Setup

```bash
cp .env.example .env          # fill in keys (all optional for mock mode)
npx prisma generate           # generate the Prisma client (run once / after schema changes)
# With a real database:
npm run db:push               # push the schema to Postgres
npm run db:seed               # seed org, users, mailbox, emails, classifications, rules
npm run dev                   # http://localhost:3000
```

Build / run production:

```bash
npm run build
npm run start
```

### Mock mode (no keys)

With no `.env` (or placeholder values), the app runs fully:

- **Dashboard** renders stats, charts, and recent activity from mock data.
- **Inbox** list + detail render from a seeded mock inbox (`lib/mock-emails.ts`),
  with working search/priority/category/status filters.
- **Automation** shows example rules.
- **Suggested-reply streaming** works via a deterministic mock stream.
- **Auth** returns a mock demo user.

Feature flags in `lib/env.ts` (`hasSupabase`, `hasOpenAI`, `hasGoogle`,
`hasDatabase`) gate every external call. Placeholder values from `.env.example`
(e.g. `sk-...`, `your-...`) are treated as "not configured".

### Enabling a real database (Prisma 7)

Prisma 7 uses the `client` query engine, which needs a driver adapter. To connect
to Postgres:

```bash
npm i @prisma/adapter-pg pg
```

Then set `DATABASE_URL` / `DIRECT_URL` and enable the adapter block in
`lib/prisma.ts` (the `PrismaPg` lines are commented in). Until then the app stays
in mock mode. `lib/prisma.ts` instantiates the client lazily so importing it never
crashes the build/render when no database is configured.

## How the cron poll works

`GET /api/cron/poll` (protected by `CRON_SECRET` via `Authorization: Bearer <secret>`
or `x-cron-secret`) runs the pipeline for every `Mailbox`:

1. List new Gmail messages (incremental via stored `historyId`).
2. Store each unseen email (idempotent on `gmailId`).
3. Classify with OpenAI → structured JSON validated by `classificationResultSchema`
   (retries once on invalid output), save `Classification`.
4. Apply matching enabled `AutomationRule`s (assign / set priority / category / team).
5. Return a summary (`processed`, `classified`, `rulesApplied`, ...).

Gmail and OpenAI both fall back to deterministic mocks when their keys are absent.
Schedule it once per minute (e.g. Vercel Cron / an external scheduler) with the
`CRON_SECRET` header. Without a database it returns a graceful `503` rather than
crashing.

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — eslint
- `npm run db:push` — push Prisma schema
- `npm run db:seed` — seed demo data
- `npm test` — unit/component tests in watch mode (Vitest)
- `npm run test:run` — unit/component tests once (CI mode)
- `npm run test:coverage` — unit/component tests with a V8 coverage report
- `npm run test:e2e` — Playwright end-to-end tests

## Testing

All tests run in **mock mode** — no database, no API keys, no network. The Vitest
setup (`test/setup.ts`) strips every credential env var so the `hasX` flags in
`lib/env.ts` are `false` and callers fall back to deterministic mock data. External
boundaries (`@/lib/prisma`, the OpenAI SDK, `googleapis`) are mocked in service and
action tests.

### Unit / component (Vitest + Testing Library)

Vitest runs in a `jsdom` environment (`vitest.config.ts`), with the `@/*` path alias
resolved via `vite-tsconfig-paths`. Tests are co-located next to source as
`*.test.ts` / `*.test.tsx`.

```bash
npm test              # watch mode
npm run test:run      # single run (339 tests across 20 files)
npm run test:coverage # single run + coverage summary (text + HTML in coverage/)
```

### End-to-end (Playwright)

Playwright specs live in `e2e/` and run against the dev server (started
automatically in mock mode by the config). Chromium requires a one-time install:

```bash
npx playwright install chromium   # one-time browser download
npm run test:e2e                  # 18 tests across 5 specs
```

E2E runs serially (`workers: 1` in `playwright.config.ts`) so the Next.js dev
server compiles each route on-demand under a warm, uncontended server — this keeps
first-hit navigations deterministic. `npx playwright test --list` lists the specs
without running a browser.
