import { NextResponse } from 'next/server'
import { ZodError, ZodType } from 'zod'
import { AuthError } from '@/lib/auth'
import { rateLimit, RateLimits } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/auth'

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

export function jsonError(message: string, status = 400, code = 'BAD_REQUEST', extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { message, code, ...extra } }, { status })
}

/** Wrap a route handler with consistent error mapping. */
export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status, err.code)
  }
  if (err instanceof ZodError) {
    const first = err.issues[0]
    return jsonError(first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', 422, 'VALIDATION_ERROR', {
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  // Routes throw plain Errors with a status property for owned-record lookups (e.g. 404).
  const maybeStatus = (err as { status?: number } | null)?.status
  if (typeof maybeStatus === 'number' && maybeStatus >= 400 && maybeStatus < 500) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return jsonError(message, maybeStatus, maybeStatus === 404 ? 'NOT_FOUND' : 'BAD_REQUEST')
  }
  console.error('[api] unhandled error:', err)
  const message = err instanceof Error ? err.message : 'Internal server error'
  // Never leak internals in production
  return jsonError(process.env.NODE_ENV === 'production' ? 'Internal server error' : message, 500, 'INTERNAL')
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new AuthError('INVALID_JSON', 'Request body must be valid JSON.', 400)
  }
  return schema.parse(raw)
}

export async function enforceRateLimitAsync(routeKey: string, cfg: { limit: number; windowMs: number } = RateLimits.api) {
  const ip = await getClientIp()
  const res = rateLimit(`${routeKey}:${ip}`, cfg.limit, cfg.windowMs)
  if (!res.allowed) {
    throw new AuthError('RATE_LIMITED', `Too many requests. Try again in ${res.retryAfterSec}s.`, 429)
  }
}

export function parseIntParam(value: string | null, def: number, max = 100): number {
  const n = parseInt(value || '', 10)
  if (!Number.isFinite(n) || n < 1) return def
  return Math.min(n, max)
}
