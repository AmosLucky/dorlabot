import { env } from '@/lib/env'
import { hmacSha256Hex, safeEqual, dedupeKey } from '@/lib/crypto'

/**
 * Meta webhook payload shapes (subset we consume).
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/reference/page/
 */

export type MetaWebhookPayload = {
  object: string
  entry: MetaWebhookEntry[]
}

export type MetaWebhookEntry = {
  id: string
  time?: number
  changes?: MetaChange[]
  messaging?: MetaMessagingItem[]
}

export type MetaChange = {
  field: string
  value: {
    item?: string // comment | post | reaction...
    verb?: string // add | remove | edited
    comment_id?: string
    post_id?: string
    parent_id?: string
    message?: string
    from?: { id: string; name?: string }
    created_time?: number
    photo_id?: string
    video_id?: string
    [k: string]: unknown
  }
}

export type MetaMessagingItem = {
  sender?: { id: string }
  recipient?: { id: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    is_removed?: boolean
    attachments?: unknown[]
    quick_reply?: { payload?: string }
    reply_to?: { mid?: string }
  }
  postback?: { payload?: string; title?: string }
  delivery?: { mids?: string[]; watermark?: number }
  read?: { watermark?: number }
  [k: string]: unknown
}

/**
 * Verify X-Hub-Signature-256: "sha256=<hmac_sha256_hex(app_secret, raw_body)>".
 * Requires META_APP_SECRET to be configured.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = env.meta.appSecret
  if (!appSecret) return false
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const expected = hmacSha256Hex(appSecret, rawBody)
  const provided = signatureHeader.slice('sha256='.length).trim().toLowerCase()
  return safeEqual(expected, provided)
}

/** Deterministic idempotency key so replayed/duplicate events never trigger duplicate sends. */
export function computeEventDedupeKey(payload: MetaWebhookPayload, entry: MetaWebhookEntry): string {
  const parts: (string | number | undefined)[] = [payload.object, entry.id, entry.time]
  if (entry.changes) {
    for (const c of entry.changes) {
      parts.push(c.field, c.value?.item, c.value?.verb, c.value?.comment_id, c.value?.post_id, c.value?.from?.id, c.value?.created_time)
    }
  }
  if (entry.messaging) {
    for (const m of entry.messaging) {
      parts.push(m.sender?.id, m.recipient?.id, m.timestamp, m.message?.mid, m.postback?.payload, m.delivery?.watermark, m.read?.watermark)
    }
  }
  return dedupeKey(...parts)
}

/** Extract the page id that owns this entry ("recipient" for messaging, entry.id for feed). */
export function extractEntryPageId(entry: MetaWebhookEntry): string | null {
  if (entry.messaging && entry.messaging.length > 0) {
    const recipientId = entry.messaging[0]?.recipient?.id
    if (recipientId) return recipientId
  }
  return entry.id || null
}

export function parseWebhookPayload(raw: string): MetaWebhookPayload | null {
  try {
    const parsed = JSON.parse(raw) as MetaWebhookPayload
    if (!parsed || typeof parsed !== 'object' || typeof parsed.object !== 'string' || !Array.isArray(parsed.entry)) return null
    return parsed
  } catch {
    return null
  }
}
