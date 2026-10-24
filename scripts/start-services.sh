#!/bin/bash
# Start user-level services for the DorlaCode platform (sandbox/dev convenience).
# In production, use real PostgreSQL/Redis services — see DEPLOYMENT.md.
set -u

export LD_LIBRARY_PATH=/tmp/redisx/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}

# PostgreSQL 16 (port 5433)
if ! /tmp/pgx/bin/pg_ctl -D /home/z/pgdata status >/dev/null 2>&1; then
  echo "[services] starting PostgreSQL on :5433"
  /tmp/pgx/bin/pg_ctl -D /home/z/pgdata -l /home/z/pgdata/pg.log -o "-p 5433 -k /tmp" start
else
  echo "[services] PostgreSQL already running"
fi

# Redis 8 (port 6380)
if ! /tmp/redisx/usr/bin/redis-cli -p 6380 ping >/dev/null 2>&1; then
  echo "[services] starting Redis on :6380"
  nohup /tmp/redisx/usr/bin/redis-server --port 6380 --save '' --appendonly no --dir /tmp > /tmp/redis.log 2>&1 &
  sleep 1
else
  echo "[services] Redis already running"
fi

# Background worker
if ! pgrep -f "bun workers/index.ts" >/dev/null 2>&1; then
  echo "[services] starting BullMQ worker"
  cd /home/z/my-project && nohup bun run worker > /tmp/worker.log 2>&1 &
else
  echo "[services] worker already running"
fi

echo "[services] done."
