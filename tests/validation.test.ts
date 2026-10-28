import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit } from '../src/lib/rate-limit'
import { validateEnvAtStartup } from '../src/lib/env'
import { automationUpsertSchema } from '../src/features/automations/schema'

describe('rate limiting (sliding window)', () => {
  it('allows requests under the limit and blocks beyond it', () => {
    const key = `test:${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true)
    }
    const blocked = rateLimit(key, 5, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('keys are isolated per bucket', () => {
    const a = `t1:${Math.random()}`
    const b = `t2:${Math.random()}`
    for (let i = 0; i < 3; i++) rateLimit(a, 3, 60_000)
    expect(rateLimit(a, 3, 60_000).allowed).toBe(false)
    expect(rateLimit(b, 3, 60_000).allowed).toBe(true)
  })
})

describe('environment startup validation', () => {
  it('flags missing AUTH_SECRET in production mode', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_SECRET', 'insecure-dev-secret-change-me')
    try {
      const result = validateEnvAtStartup()
      expect(result.ok).toBe(false)
      expect(result.problems.join(' ')).toMatch(/AUTH_SECRET/)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('automation upsert schema (server-side validation)', () => {
  const base = {
    pageId: 'page-1',
    name: 'Test automation',
    replyTemplate: 'Hi {{first_name}}!',
    rules: [],
  }

  it('accepts a valid COMMENT_REPLY automation', () => {
    const parsed = automationUpsertSchema.safeParse({ ...base, type: 'COMMENT_REPLY', matchMode: 'any', enabledPosts: ['ALL'] })
    expect(parsed.success).toBe(true)
  })

  it('requires keywords when triggering only on keywords', () => {
    const parsed = automationUpsertSchema.safeParse({
      ...base,
      type: 'COMMENT_REPLY',
      matchMode: 'keywords',
      rules: [],
    })
    expect(parsed.success).toBe(false)
  })

  it('requires a welcome message body', () => {
    const parsed = automationUpsertSchema.safeParse({
      pageId: 'p', name: 'w', type: 'WELCOME_MESSAGE', replyTemplate: '', matchMode: 'any', enabledPosts: ['ALL'], rules: [],
    })
    expect(parsed.success).toBe(false)
  })

  it('requires keyword rules or a fallback for DEFAULT_REPLY', () => {
    const empty = automationUpsertSchema.safeParse({
      pageId: 'p', name: 'd', type: 'DEFAULT_REPLY', replyTemplate: '', fallbackReply: '', matchMode: 'keywords+fallback', enabledPosts: ['ALL'], rules: [],
    })
    expect(empty.success).toBe(false)
    const withFallback = automationUpsertSchema.safeParse({
      pageId: 'p', name: 'd', type: 'DEFAULT_REPLY', replyTemplate: '', fallbackReply: 'Thanks!', matchMode: 'keywords+fallback', enabledPosts: ['ALL'], rules: [],
    })
    expect(withFallback.success).toBe(true)
  })

  it('rejects over-long keywords via rules max length', () => {
    const parsed = automationUpsertSchema.safeParse({
      ...base,
      type: 'COMMENT_REPLY',
      matchMode: 'keywords',
      rules: Array.from({ length: 31 }, (_, i) => ({ keyword: `k${i}`, matchType: 'CONTAINS', isActive: true })),
    })
    expect(parsed.success).toBe(false)
  })
})
