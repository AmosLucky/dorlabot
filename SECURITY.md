# Security Architecture

## Threat model & controls

| Area | Control | Implementation |
|---|---|---|
| Password storage | scrypt (N=16384, r=8, p=1) with per-user salt, timing-safe compare | `src/lib/password.ts` |
| Sessions | Opaque 256-bit tokens; only SHA-256 hashes stored; HTTP-only + SameSite=Lax + Secure (prod) cookies; DB-backed with revocation | `src/lib/auth.ts` |
| Brute force | Per-IP sliding-window rate limits + per-account lockout (5 fails → 15 min) | `src/lib/rate-limit.ts`, login route |
| Email verification / reset | Single-use SHA-256-hashed tokens with TTL; reset revokes all sessions | `src/features/auth/tokens.ts` |
| 2FA | Optional TOTP (RFC 6238); secret AES-256-GCM encrypted at rest; disable requires password | `/api/auth/2fa/*` |
| Tenant isolation | Every customer query filters by `userId` from the **server session**; client-supplied IDs are never trusted | all API routes |
| Admin authorization | `requireAdmin()` server-side check on every admin route + layout guard | `src/lib/auth.ts` |
| OAuth security | One-time state tokens (10 min TTL, single-use), server-side code exchange, exact redirect URI, state bound to user | `/api/facebook/*` |
| Token storage | Page/user tokens encrypted with AES-256-GCM (auth-tagged); never returned by any API, never logged; disconnect destroys ciphertext | `src/lib/crypto.ts` |
| Webhook integrity | `X-Hub-Signature-256` HMAC-SHA256 verification with timing-safe compare; rejects unsigned in production | `src/lib/meta/webhook.ts` |
| Webhook idempotency | Deterministic `dedupeKey` unique constraint; events persisted before ack; worker re-entry guards | webhook route + engine |
| Duplicate sends | Unique `mid`, unique `commentId`, unique `(campaignId, contactId)` | Prisma schema |
| CSRF | Session cookie SameSite=Lax + state-changing routes behind session; no cross-site form posts | cookie config |
| Input validation | Zod schemas on every API payload; output escaped by React | all routes |
| Injection | Prisma parameterized queries only; no raw string SQL | `src/lib/db.ts` |
| Redirect safety | Tracked-link targets restricted to http/https | `/l/[slug]` |
| Secrets exposure | No secrets in `NEXT_PUBLIC_*`; error responses sanitized in production; tokens never serialized | `src/lib/api.ts` |
| Audit trail | Security-relevant actions recorded with actor, target, IP | `src/lib/audit.ts` |
| Rate limiting | Login/register/reset/contact endpoints per-IP limited | `src/lib/rate-limit.ts` |

## Data retention & deletion

- Disconnecting a Page immediately destroys the encrypted token and pauses automations
- Account deletion (by admin or via support request) cascades to sessions, pages, automations,
  contacts, campaigns, recipients, messages, tracked links — full removal
- Contact deletion removes the contact + tag assignments; message rows persist with severed
  contact links for audit integrity
- Email verification/reset tokens expire automatically (48h / 30min)

## Production hardening checklist

- [ ] All secrets from environment (32-byte random values); never in code or repo
- [ ] `NODE_ENV=production` (enables Secure cookies, sanitized errors)
- [ ] HTTPS enforced; HSTS enabled at the proxy
- [ ] `META_APP_SECRET` set (webhook signature verification active)
- [ ] Restrict DB/Redis to private networks; strong credentials
- [ ] Rotate `AUTH_SECRET`/`TOKEN_ENCRYPTION_KEY` via planned key-rotation procedure
- [ ] Log aggregation + alerting on 5xx spikes and BackgroundJobFailure growth
- [ ] Regular dependency audit (`bun pm audit` / dependabot)
- [ ] Backups encrypted + restore-tested (see DEPLOYMENT.md)

## Reporting

Vulnerabilities: security@dorlacode.com (please include reproduction steps).
