import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Health check for load balancers and uptime monitors. */
export async function GET() {
  const checks: Record<string, string> = {}
  let ok = true

  try {
    await db.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch (err) {
    checks.database = 'error'
    ok = false
  }

  if (env.redisUrl) {
    checks.redis = 'configured'
  } else {
    checks.redis = 'not_configured'
    checks.redisNote = 'Background processing degraded: set REDIS_URL.'
  }

  checks.meta = env.meta.configured ? 'configured' : 'not_configured'
  checks.email = env.email.configured ? 'configured' : 'dev_outbox'

  return NextResponse.json(
    { ok, status: ok ? 'healthy' : 'degraded', checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  )
}
