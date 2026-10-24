# Deployment Guide — dorlacode.com

## 1. Hosting requirements

The platform is a full Node.js stack — it **cannot** run on PHP-only shared hosting. Required:

- Node.js 20+ (or Bun 1.1+) host: VPS (Hetzner/DigitalOcean/AWS Lightsail) or managed Node platform
- PostgreSQL 14+ (managed RDS/Neon/Supabase or self-hosted)
- Redis 6+ (managed ElastiCache/Upstash or self-hosted)
- A persistent worker process (systemd service or equivalent)
- HTTPS termination (reverse proxy: Nginx/Caddy, or platform TLS)
- Outbound HTTPS to `graph.facebook.com` for API calls; inbound HTTPS for webhooks

## 2. Environment

```bash
cp .env.example .env   # then fill every value; generate secrets:
openssl rand -hex 32   # AUTH_SECRET
openssl rand -hex 32   # TOKEN_ENCRYPTION_KEY
openssl rand -hex 16   # META_WEBHOOK_VERIFY_TOKEN
```

Validate at startup: the app logs warnings for missing production-critical vars
(`AUTH_SECRET`, `REDIS_URL`, `META_WEBHOOK_VERIFY_TOKEN`).

## 3. Build & run (VPS example)

```bash
git clone <repo> /opt/dorlacode && cd /opt/dorlacode
bun install --production=false
bunx prisma migrate deploy
bun run build

# App
PORT=3000 bun ./node_modules/.bin/next start -p 3000
# (or `bun run start` for standalone output)

# Worker (MUST run for webhooks/campaigns)
bun run worker
```

### systemd units

```ini
# /etc/systemd/system/dorlacode-web.service
[Unit]
Description=DorlaCode web
After=network.target postgresql.service redis.service

[Service]
WorkingDirectory=/opt/dorlacode
EnvironmentFile=/opt/dorlacode/.env
ExecStart=/usr/local/bin/bun run start
Restart=always
RestartSec=5
User=dorla

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/dorlacode-worker.service
[Unit]
Description=DorlaCode BullMQ worker
After=network.target redis.service postgresql.service

[Service]
WorkingDirectory=/opt/dorlacode
EnvironmentFile=/opt/dorlacode/.env
ExecStart=/usr/local/bin/bun run worker
Restart=always
RestartSec=5
User=dorla

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dorlacode-web dorlacode-worker
```

## 4. Reverse proxy & TLS (Nginx)

```nginx
server {
  server_name dorlacode.com www.dorlacode.com;
  listen 443 ssl http2;
  ssl_certificate     /etc/letsencrypt/live/dorlacode.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/dorlacode.com/privkey.pem;

  client_max_body_size 2m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

DNS: point `dorlacode.com` (and `www`) at the VPS; issue certificates with certbot.
If the domain currently sits on PHP shared hosting, update the DNS A/CNAME records to
the new host first — webhook URLs must be reachable at `https://dorlacode.com/...`.

## 5. Database migrations

```bash
bunx prisma migrate deploy          # apply committed migrations
bun prisma/seed.ts                  # base seed (plans/settings/admin) — idempotent
```

`prisma db push` is a dev-only shortcut; use migrations in production.

## 6. Webhooks & Meta app

- Webhook URL: `https://dorlacode.com/api/webhooks/meta`
- Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
- The endpoint verifies `X-Hub-Signature-256` with `META_APP_SECRET` and returns 200 fast
- Delivery latency: events are persisted then queued — workers process them asynchronously
- See META_APP_REVIEW.md for app review preparation

## 7. Health checks & monitoring

- `GET /api/health` → `{ ok, status, checks: { database, redis, meta, email } }` (503 when DB down)
- Monitor: web service, worker process (systemd), Redis memory, Postgres connections
- Watch `BackgroundJobFailure` (admin → Monitoring) and webhook event stats
- Ship logs (journald → your log aggregator); app logs are structured `console.*`

## 8. Backups & recovery

```bash
# Nightly Postgres backup (retain 14+ days)
0 2 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/dorla-$(date +\%F).sql.gz
```

- Redis is a queue only — losing it never loses webhook events (they're persisted in
  Postgres first; the maintenance sweep reprocesses PENDING events)
- Encrypt backups at rest; test restores quarterly
- Recovery: provision infra → restore DB → set env → `prisma migrate deploy` → start web+worker

## 9. Rollback

```bash
git checkout <previous-tag>
bun install
bun run build
sudo systemctl restart dorlacode-web dorlacode-worker
# If migrations must be reverted, restore the pre-migration DB dump.
```

## 10. Scaling notes

- Web tier is stateless — scale horizontally behind the load balancer
- Worker concurrency: adjust `concurrency` per queue in `workers/index.ts`
- Campaign throughput: `campaignRatePerMinute` platform setting (queue-level limiter)
- Sessions are DB-backed → safe behind multiple app instances
- For multi-instance rate limiting, front login/register endpoints with a shared limiter
