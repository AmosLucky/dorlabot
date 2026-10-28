/**
 * In-memory sliding-window rate limiter (per process).
 * For multi-instance production deployments, front this with the platform
 * load balancer's rate limiting or swap in a Redis-backed limiter.
 * Login brute-force is additionally protected by per-account lockout in the DB.
 */

type Bucket = { hits: number[] }

const globalStore = globalThis as unknown as { __rateBuckets?: Map<string, Bucket> }
const buckets: Map<string, Bucket> = globalStore.__rateBuckets ?? new Map()
globalStore.__rateBuckets = buckets

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec: number }

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    const oldest = bucket.hits[0]
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000) }
  }
  bucket.hits.push(now)
  buckets.set(key, bucket)
  if (buckets.size > 10000) {
    // opportunistic cleanup
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 }
}

export const RateLimits = {
  login: { limit: 10, windowMs: 5 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  forgotPassword: { limit: 5, windowMs: 60 * 60 * 1000 },
  resendVerification: { limit: 5, windowMs: 60 * 60 * 1000 },
  api: { limit: 120, windowMs: 60 * 1000 },
}
