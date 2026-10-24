import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { verifyWebhookSignature, parseWebhookPayload, computeEventDedupeKey, extractEntryPageId } from '@/lib/meta/webhook'
import { enqueueMetaEvent } from '@/lib/queue'

/**
 * Meta webhook endpoint.
 *  GET  → subscription verification (hub.challenge)
 *  POST → signature-verified ingestion: persist first, then enqueue.
 * The handler returns 200 quickly; all business logic runs in the worker.
 */

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && challenge) {
    if (env.meta.webhookVerifyToken && token === env.meta.webhookVerifyToken) {
      return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
    }
    return new Response('Forbidden', { status: 403 })
  }
  return new Response('Bad Request', { status: 400 })
}

export async function POST(req: Request) {
  const raw = await req.text()

  // 1. Signature verification (required whenever the app secret is configured).
  const signature = req.headers.get('x-hub-signature-256')
  let signatureVerified = false
  if (env.meta.appSecret) {
    if (!verifyWebhookSignature(raw, signature)) {
      console.warn('[webhook] signature verification failed — rejecting')
      // Meta retries invalid-signature deliveries; 401 makes the problem visible.
      return new Response('Invalid signature', { status: 401 })
    }
    signatureVerified = true
  } else if (env.isProduction) {
    console.error('[webhook] META_APP_SECRET missing in production — rejecting delivery')
    return new Response('Webhook misconfigured', { status: 500 })
  } else {
    console.warn('[webhook] META_APP_SECRET not configured; accepting in non-production with signatureVerified=false')
  }

  // 2. Payload validation.
  const payload = parseWebhookPayload(raw)
  if (!payload) {
    return new Response('Bad Request', { status: 400 })
  }

  // 3. Persist every entry durably BEFORE acknowledging (idempotent by dedupe key).
  const accepted: string[] = []
  try {
    for (const entry of payload.entry ?? []) {
      const fbPageId = extractEntryPageId(entry)
      const key = computeEventDedupeKey(payload, entry)
      const existing = await db.webhookEvent.findUnique({ where: { dedupeKey: key }, select: { id: true } })
      if (existing) continue // duplicate delivery — acknowledge without reprocessing

      const linkedPage = fbPageId
        ? await db.facebookPage.findFirst({ where: { fbPageId }, select: { id: true, userId: true } })
        : null

      const event = await db.webhookEvent.create({
        data: {
          userId: linkedPage?.userId ?? null,
          pageId: linkedPage?.id ?? null,
          fbPageId: fbPageId,
          objectType: payload.object,
          field:
            entry.changes?.[0]?.field ??
            (entry.messaging?.[0]?.delivery ? 'message_deliveries' : entry.messaging?.[0]?.read ? 'message_reads' : entry.messaging?.[0]?.postback ? 'messaging_postbacks' : entry.messaging ? 'messages' : null),
          signatureVerified,
          payload: { object: payload.object, entry: [entry] } as never,
          dedupeKey: key,
          status: 'PENDING',
        },
      })
      accepted.push(event.id)
    }

    // 4. Enqueue best-effort; the maintenance sweep covers Redis outages.
    for (const id of accepted) {
      await enqueueMetaEvent(id)
    }
  } catch (err) {
    console.error('[webhook] ingestion error:', err)
    // 500 → Meta will retry the delivery.
    return new Response('Ingestion error', { status: 500 })
  }

  // 5. Prompt 200 per Meta requirements.
  return new Response('EVENT_RECEIVED', { status: 200 })
}
