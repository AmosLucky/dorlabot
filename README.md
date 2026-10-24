# DorlaCode — Multi-Tenant Facebook Messenger Automation SaaS

Production-grade platform for Facebook Page Messenger automation and comment-to-private-message
marketing, built on the **official Meta Graph API** with policy-aware sending at every step.

**Live domain (deployment target):** https://dorlacode.com

---

## Feature overview

| Area | Highlights |
|---|---|
| Public site | Landing, features, pricing (DB-driven plans), FAQ, contact form, Privacy/Terms/Cookie policies |
| Auth | Email+password, secure scrypt hashing, DB-backed sessions (HTTP-only cookies), email verification, password reset, optional TOTP 2FA, login rate limiting + account lockout |
| Facebook connection | Official OAuth (server-side code exchange, one-time state), long-lived token upgrade, page selection step, AES-256-GCM encrypted tokens, webhook auto-subscribe, sync/disconnect/reconnect |
| Comment-to-DM | Keyword or any-comment triggers, post targeting, personalization (`{{first_name}}` with `there` fallback), one-reply-per-comment idempotency, policy-window enforcement, full outcome tracking (processed/skipped/failed/ineligible) |
| Welcome & default replies | First-interaction welcome with optional quick replies, keyword-based default replies with fallback, reply-loop protection |
| Contacts | Auto-created from real interactions, Page-scoped IDs only, messaging-eligibility states, tags/segments, notes, CSV export, opt-out suppression |
| Campaigns | Audience estimates pre-launch, per-recipient eligibility re-check at send time, BullMQ queue delivery with rate limiting/retries, schedule or send now, cancel, honest progress + audit trail |
| Analytics | Chart.js dashboards, sends/deliveries/reads/failures, unique clickers, CTR with **clearly labeled denominators**, date ranges (7/30/90 days), campaign comparison |
| Admin console | Platform stats, user management (suspend/reactivate/delete), all Pages overview, webhook health, failed-job retry/resolve, audit logs, platform settings (editable eligibility windows) |
| Background jobs | Redis + BullMQ workers (`meta-events`, `campaign-sends`, `maintenance`), durable persistence before ack, DB sweep fallback during Redis outages, failure recording + admin retries |

## Tech stack

- **Next.js 16 (App Router) + TypeScript 5** — UI, API route handlers, server services
- **Bootstrap 5 + Bootstrap Icons** — custom SaaS theme (no other CSS framework)
- **PostgreSQL + Prisma ORM** — normalized schema, migrations via `prisma migrate`
- **Redis + BullMQ** — durable queue processing via a dedicated worker process
- **Chart.js + react-chartjs-2** — analytics
- **Auth.js-equivalent custom auth** — scrypt + opaque session tokens + TOTP 2FA (full control over verification/reset/lockout flows)
- **Meta Graph API** — thin typed client, `X-Hub-Signature-256` webhook verification

## Project structure

```
src/app/                 App Router pages & route handlers
  (public)/              Landing, pricing, features, FAQ, contact, legal pages
  (auth)/                Register, login (+2FA step), verify-email, reset flows
  (dashboard)/           Customer dashboard (pages, automations, contacts, campaigns, analytics…)
  admin/                 Super-admin console (users, pages, monitoring, audit, settings)
  api/                   REST route handlers incl. /api/webhooks/meta, /api/facebook/*
  l/[slug]               Tracked-link redirect endpoint
src/components/          Bootstrap-based UI components (+ automations editor)
src/features/            Feature schemas & token helpers (auth, automations)
src/lib/                 db, env, crypto (AES-GCM), password (scrypt), auth, rate-limit,
                         api helpers, audit, settings, template, email, queue (BullMQ)
src/lib/meta/            Graph API client + webhook payload/signature helpers
src/server/              Business services: automation engine, campaign dispatch/sender, stats
src/workers → workers/   BullMQ worker entry (bun workers/index.ts)
prisma/                  schema.prisma, seed.ts
tests/                   Vitest unit/integration tests (mocked Meta responses)
scripts/                 ops helpers (e.g. dev service bootstrap)
```

## Quick start (development)

```bash
# 1. Configure environment
cp .env.example .env     # fill values (see .env.example comments)

# 2. Install & create schema
bun install
bunx prisma generate
bunx prisma migrate deploy      # production
# or: bunx prisma db push       # quick dev sync

# 3. Seed base data (plans, settings, admin, demo customer)
bun prisma/seed.ts
# with clearly-marked sample data for previews:
SEED_DEMO_DATA=1 bun prisma/seed.ts

# 4. Run everything
bun run dev      # Next.js on :3000
bun run worker   # BullMQ worker (separate terminal)
```

### Default seeded accounts (CHANGE IN PRODUCTION)

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@dorlacode.com` | `Admin123!` |
| Demo customer | `demo@dorlacode.com` | `Demo123!` |

The demo customer (when seeded with `SEED_DEMO_DATA=1`) contains clearly-marked SAMPLE data — a
*disconnected* sample Page, paused sample automations, sample contacts/campaigns — so every screen
and chart can be reviewed without pretending a real Facebook connection exists.

## Environment variables

See [`.env.example`](./.env.example) for the full annotated list. Security-critical points:

- `AUTH_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`
- Meta credentials are **optional at runtime**: until configured, the app displays honest
  “integration setup required” states and never simulates connections or sends
- Never expose secrets via `NEXT_PUBLIC_*`

## Facebook / Meta configuration (operator checklist)

1. Create a Meta app (Business type) at https://developers.facebook.com/apps
2. Add products: **Facebook Login for Business** (or Facebook Login) + **Messenger**
3. Configure OAuth: Valid OAuth Redirect URIs = `https://dorlacode.com/api/facebook/callback`
4. Configure webhooks: callback URL `https://dorlacode.com/api/webhooks/meta`, verify token from env
5. Subscribe to webhook fields: `feed`, `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`
6. Request permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging`
7. Complete App Review with reviewer instructions (see [META_APP_REVIEW.md](./META_APP_REVIEW.md))
8. Configure your Page's messenger settings (domain allowlist etc.) as required

Full production deployment guide (Node hosting, DNS/HTTPS, worker supervision, backups,
health checks, rollback): [DEPLOYMENT.md](./DEPLOYMENT.md).
Security architecture & hardening checklist: [SECURITY.md](./SECURITY.md).

## Testing

```bash
bun run test      # Vitest — crypto, webhook signatures, eligibility, dedupe, CTR, auth
```

Unit/integration tests use **mocked Meta API responses**. Live integration against a real
Meta app is manual by design and clearly separated (see test file headers).

## Key API endpoints

| Method + path | Purpose |
|---|---|
| `POST /api/auth/register` | Create account (+ verification email) |
| `POST /api/auth/login` | Sign in (handles 2FA step) |
| `POST /api/auth/forgot-password` / `reset-password` | Password reset |
| `GET/POST/PATCH/DELETE /api/automations` | Automation CRUD (tenant-checked) |
| `GET /api/facebook/connect` | Start official OAuth flow |
| `GET /api/facebook/callback` | OAuth callback (state-validated) |
| `GET/POST /api/facebook/pages` | List / connect pages from selection |
| `PATCH/DELETE /api/facebook/pages/[id]` | Sync / disconnect |
| `GET/POST /api/webhooks/meta` | Meta webhook verification + ingestion |
| `POST /api/campaigns/[id]/estimate` / `launch` / `cancel` | Campaign lifecycle |
| `GET /api/analytics/summary` / `timeseries` / `campaigns` | Analytics |
| `GET /l/[slug]` | Tracked-link redirect + click dedupe |
| `GET /api/health` | Health check (DB, Redis, Meta, email status) |

## Messaging policy compliance (summary)

- One private reply per comment, enforced by a DB unique constraint
- Private-reply window configurable (default 7 days) via platform settings
- Standard messages require an open 24h messaging window
- Campaigns re-verify each recipient's eligibility at send time; opted-out contacts are always excluded
- No bulk commenting, spam automation, or policy-bypass features of any kind
- Commenting does **not** opt anyone into marketing
- Every skipped/ineligible event is visible with its reason

> DorlaCode is not affiliated with Meta Platforms, Inc.
