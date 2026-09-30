# Jenkins Upgrade Rehearsal · M0

A free, deterministic Jenkins upgrade risk scanner. The experiment is whether administrators of complex installations will consider paying **$199/controller** for a future private local rehearsal. This repository does **not** implement that rehearsal, a checkout, an agent, Jenkins access, or an LLM.

## Local setup

Node 22.14+ and npm are required.

```sh
npm ci
cp .env.example .env.local
npm run ingest -- --fixture  # offline, visibly labeled synthetic demo
npm run dev
```

Open http://localhost:3000. To use current official metadata instead:

```sh
npm run ingest
```

With no database configured, normalized public metadata is atomically cached in `.data/active.json`. Reports work locally, but events are not persisted and lead submission explicitly fails with a configuration message. There is no fake success state. Inventories and reports are never written to disk.

## Supabase setup

1. Create a Supabase project and apply `supabase/migrations/001_scanner.sql` through the SQL editor or Supabase CLI migrations.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server-only).
3. Set `EVENT_SIGNING_SECRET` to a random 32-byte secret, for example using `openssl rand -hex 32`.
4. Run `npm run ingest` to activate the first official snapshot. Fixture activation in the production database is intentionally rejected.
5. Start the app. Completed scans, derived finding codes, events and submitted leads will be persisted.

All tables use RLS without public policies. Anonymous/authenticated API roles cannot access data or call write functions. The server service role performs bounded validated operations. Metadata activation, completed-scan persistence, and lead/event writes each run in a PostgreSQL transaction.

## Environment

| Variable                    | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL, server only                              |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database key; never expose to browser              |
| `EVENT_SIGNING_SECRET`      | Signs 24-hour report sessions and HMACs rate-limit identifiers |
| `CRON_SECRET`               | Authenticates the Vercel ingestion cron                        |

Production fails closed if database/signing configuration is missing. Development uses explicit no-persistence mode. No inventory-retention switch exists: raw retention is always off.

## Architecture

Next.js App Router 16.3.7, strict TypeScript, React, Tailwind, Zod, Supabase/Postgres and Vitest. The analysis engine in `src/lib/scanner` is pure TypeScript with no HTTP/database imports. The metadata provider and snapshot store interfaces separate source ingestion from analysis. Static page shell is server-rendered; form/report interaction is client-side.

## Metadata ingestion

`npm run ingest` discovers the latest LTS, requests the version-specific official Update Center, strips its known JSONP wrapper without evaluation, validates and normalizes only scanner fields, and atomically activates the new snapshot. Failure preserves the previous active snapshot. Live ingestion was verified on 2026-09-30 against LTS **2.580.1**, with **2,113** catalog plugins. CI uses fixtures only.

Daily Vercel cron: `/api/cron/metadata`. Configure `CRON_SECRET`. Plan limits must permit the configured 120-second function duration; manual CLI ingestion is an alternative. Metadata older than seven days is rejected by scans. Monitor ingestion failures and review Java policy when a new LTS line is released.

## Testing

```sh
npm run typecheck
npm run lint
npm run test:coverage
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
```

Fixtures cover current and old Jenkins, Java boundaries, deprecations, affected and fixed advisory versions, unknown comparisons, missing plugins, conflicts/cycles, malformed text and duplicates. PGlite executes the real SQL migration to verify transactions, privileges, rate limits, event deduplication and privacy projections. No tests call Jenkins live. Coverage gates apply to the domain analysis. `npm run format` formats sources.

## Deployment

Import this repository into Vercel, select Next.js, set the four environment variables, apply the Supabase migration, run initial live ingestion, and deploy. No external deployment is created automatically by this repository. Validate a real scan, lead submission and funnel query after deployment. Keep the service key out of public environment variables and rotate all secrets if exposed.

## Privacy & operational boundaries

Only inventory IDs/versions are accepted; no credentials, tokens, JENKINS_HOME, job configuration or source. Input is UTF-8 plain text, at most 128 KiB and 2,000 plugins. Compressed HTTP bodies and binary uploads are rejected. No input executes. Browser reports stay in memory, and the input textarea clears after success. No localStorage, third-party analytics or raw-inventory logging is used.

Persisted findings contain only category/severity/code, never plugin IDs, installed versions or messages. Leads intentionally retain submitted email/company/size/comment. Avoid confidential text in comments. Hosting may retain request/network metadata; configure provider logging accordingly. See `docs/validation-metrics.md` for retention SQL.

On Vercel, rate limits use its trusted overwritten `x-vercel-forwarded-for` header, HMACed with the server secret. On other production hosts the conservative shared bucket applies until a trusted proxy strategy is configured. Production rate limits live in Postgres, not process memory; database failure blocks requests.

This is static analysis, not proof that an upgrade will succeed. See [metadata semantics](docs/jenkins-metadata.md), [product scope](docs/product.md), [architecture](docs/architecture.md), and [validation metrics](docs/validation-metrics.md).

## Local filesystem troubleshooting

On macOS, cloud-synced Documents folders can stall or partially hydrate large `node_modules` trees. If a previously successful build starts reporting inconsistent package reads, run the project from a non-synced development directory and install dependencies there. Final verification for this implementation used a clean local copy outside iCloud after observing this issue; all source remains in this workspace.
