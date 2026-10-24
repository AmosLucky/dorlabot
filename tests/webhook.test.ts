import { describe, it, expect, beforeEach, vi } from 'vitest'
import { verifyWebhookSignature, parseWebhookPayload, computeEventDedupeKey, extractEntryPageId, type MetaWebhookPayload } from '../src/lib/meta/webhook'

const APP_SECRET = 'test-app-secret'
const RAW_BODY = JSON.stringify({
  object: 'page',
  entry: [
    {
      id: 'PAGE1',
      time: 1700000000000,
      changes: [
        {
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'C1',
            post_id: 'P1',
            message: 'price please',
            from: { id: 'USER1', name: 'Sara' },
            created_time: 1700000000,
          },
        },
      ],
    },
  ],
})

function signature(body: string, secret = APP_SECRET): string {
  const { hmacSha256Hex } = await0(secret, body)
  return `sha256=${hmacSha256Hex(secret, body)}`
}
// small helper to avoid import duplication
import { hmacSha256Hex } from '../src/lib/crypto'
function await0(secret: string, body: string) {
  return { hmacSha256Hex }
}

describe('Meta webhook signature verification', () => {
  beforeEach(() => {
    vi.stubEnv('META_APP_SECRET', APP_SECRET)
  })

  it('accepts a correctly signed payload', () => {
    const sig = `sha256=${hmacSha256Hex(APP_SECRET, RAW_BODY)}`
    expect(verifyWebhookSignature(RAW_BODY, sig)).toBe(true)
  })

  it('rejects a wrong signature', () => {
    const sig = `sha256=${hmacSha256Hex('other-secret', RAW_BODY)}`
    expect(verifyWebhookSignature(RAW_BODY, sig)).toBe(false)
  })

  it('rejects when the body was modified after signing', () => {
    const sig = `sha256=${hmacSha256Hex(APP_SECRET, RAW_BODY)}`
    expect(verifyWebhookSignature(`${RAW_BODY} `, sig)).toBe(false)
  })

  it('rejects malformed signature headers', () => {
    expect(verifyWebhookSignature(RAW_BODY, null)).toBe(false)
    expect(verifyWebhookSignature(RAW_BODY, 'md5=abcd')).toBe(false)
    expect(verifyWebhookSignature(RAW_BODY, 'sha256=')).toBe(false)
  })

  it('rejects everything when no app secret is configured', () => {
    vi.stubEnv('META_APP_SECRET', '')
    const sig = `sha256=${hmacSha256Hex(APP_SECRET, RAW_BODY)}`
    expect(verifyWebhookSignature(RAW_BODY, sig)).toBe(false)
  })
})

describe('webhook payload parsing', () => {
  it('parses valid payloads', () => {
    const parsed = parseWebhookPayload(RAW_BODY)
    expect(parsed).not.toBeNull()
    expect(parsed!.object).toBe('page')
    expect(parsed!.entry[0].changes![0].value.comment_id).toBe('C1')
  })

  it('rejects malformed JSON and wrong shapes', () => {
    expect(parseWebhookPayload('not json')).toBeNull()
    expect(parseWebhookPayload('{"object":"page"}')).toBeNull()
    expect(parseWebhookPayload('{"entry":[]}')).toBeNull()
  })
})

describe('duplicate webhook handling (idempotency keys)', () => {
  it('produces identical dedupe keys for identical deliveries', () => {
    const payload = parseWebhookPayload(RAW_BODY) as MetaWebhookPayload
    const k1 = computeEventDedupeKey(payload, payload.entry[0])
    const payload2 = parseWebhookPayload(RAW_BODY) as MetaWebhookPayload
    const k2 = computeEventDedupeKey(payload2, payload2.entry[0])
    expect(k1).toBe(k2)
  })

  it('produces different keys for different events', () => {
    const payload = parseWebhookPayload(RAW_BODY) as MetaWebhookPayload
    const other = JSON.parse(RAW_BODY)
    other.entry[0].changes[0].value.comment_id = 'C2'
    const payload2 = other as MetaWebhookPayload
    expect(computeEventDedupeKey(payload, payload.entry[0])).not.toBe(
      computeEventDedupeKey(payload2, payload2.entry[0])
    )
  })

  it('covers messaging events too', () => {
    const payload = parseWebhookPayload(
      JSON.stringify({
        object: 'page',
        entry: [{ id: 'PAGE1', time: 1, messaging: [{ sender: { id: 'PSID1' }, recipient: { id: 'PAGE1' }, timestamp: 5, message: { mid: 'M1', text: 'hello' } }] }],
      })
    ) as MetaWebhookPayload
    const k = computeEventDedupeKey(payload, payload.entry[0])
    expect(k).toMatch(/^[0-9a-f]{64}$/)
    expect(extractEntryPageId(payload.entry[0])).toBe('PAGE1')
  })
})
