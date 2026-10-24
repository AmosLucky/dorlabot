import { db } from '@/lib/db'
import { decryptSecret } from '@/lib/crypto'
import { getUserProfileByPsid, sendPrivateReply, sendMessageToPsid, GraphApiError } from '@/lib/meta/client'
import { checkPrivateReplyEligibility, keywordMatches, openMessagingWindow } from '@/lib/eligibility'
import { getPlatformSettings } from '@/lib/settings'
import { renderTemplate, clampMessage } from '@/lib/template'
import type { WebhookEvent, FacebookPage, Contact, Automation } from '@prisma/client'
import type { MetaMessagingItem } from '@/lib/meta/webhook'

/**
 * Automation engine — consumes persisted WebhookEvents and performs
 * policy-aware messaging via the official Graph API.
 * All sends are recorded in Message (unique constraints provide idempotency).
 */

async function resolvePage(fbPageId: string): Promise<FacebookPage | null> {
  return db.facebookPage.findFirst({
    where: { fbPageId, status: 'CONNECTED' },
  })
}

async function recordUsage(userId: string, type: string, metadata?: Record<string, unknown>) {
  const periodKey = new Date().toISOString().slice(0, 7)
  await db.usageRecord.create({ data: { userId, type, amount: 1, periodKey, metadata: metadata as never } })
}

// ── Comment → private reply ──────────────────────────────────────────

type FeedChange = { field: string; value: {
  item?: string
  verb?: string
  comment_id?: string
  post_id?: string
  message?: string
  from?: { id: string; name?: string }
  created_time?: number
} }

async function handleFeedChange(event: WebhookEvent, change: FeedChange) {
  const value = change.value
  // Only react to newly added comments.
  if (value.item !== 'comment' || value.verb !== 'add' || !value.comment_id || !value.post_id) return

  const fbPageId = (event.fbPageId || (event.payload as { entry?: { id?: string }[] })?.entry?.[0]?.id) as string
  const page = await resolvePage(fbPageId)
  if (!page || !event.pageId) return

  const automation = await db.automation.findUnique({
    where: { pageId_type: { pageId: event.pageId, type: 'COMMENT_REPLY' } },
    include: { page: true },
  })
  if (!automation) return

  const commenterName = value.from?.name ?? null
  const createdTime = value.created_time ? new Date(value.created_time * 1000) : null

  const decision = await checkPrivateReplyEligibility({
    page,
    automation,
    commentId: value.comment_id,
    postId: value.post_id,
    commentText: value.message || '',
    commenterFbUserId: value.from?.id || '',
    commenterName,
    commentCreatedTime: createdTime,
  })

  await db.automation.update({
    where: { id: automation.id },
    data: { lastRunAt: new Date(), triggeredCount: { increment: 1 } },
  })

  if (!decision.eligible) {
    // Record the skipped outcome for transparency. `skipped:`/`failed:` prefixes
    // keep these audit rows out of the unique(commentId) slot reserved for real replies.
    await db.message
      .create({
        data: {
          userId: automation.userId,
          pageId: page.id,
          automationId: automation.id,
          direction: 'OUTGOING',
          status: 'SKIPPED',
          body: '',
          commentId: `skipped:${value.comment_id}`,
          skipReason: decision.reason,
          metadata: { decision } as never,
        },
      })
      .catch(() => {
        /* marker already exists */
      })
    await db.automation.update({ where: { id: automation.id }, data: { skippedCount: { increment: 1 } } })
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: 'SKIPPED', processedAt: new Date(), lastError: `skipped:${decision.reason}` },
    })
    return
  }

  const pageToken = decryptSecret(page.accessTokenEnc)
  const text = clampMessage(
    renderTemplate(automation.replyTemplate || "Hi {{first_name}}! Thanks for your comment. Here's the information you requested.", {
      first_name: commenterName?.split(' ')[0] ?? null,
      full_name: commenterName,
      page_name: page.name,
    })
  )

  // Contact record: feed-comment sender IDs are Page-scoped IDs.
  const contact = await db.contact.upsert({
    where: { userId_fbPsid: { userId: automation.userId, fbPsid: value.from?.id || value.comment_id } },
    create: {
      userId: automation.userId,
      pageId: page.id,
      fbPsid: value.from?.id || value.comment_id,
      name: commenterName,
      firstName: commenterName?.split(' ')[0] || null,
      source: 'comment_reply',
      // Commenting alone does NOT open the standard messaging window.
      messagingState: 'UNKNOWN',
    },
    update: { lastInteractionAt: new Date(), name: commenterName ?? undefined },
  })

  try {
    const { messageId } = await sendPrivateReply(pageToken, page.fbPageId, value.comment_id, text)
    await db.message.create({
      data: {
        userId: automation.userId,
        pageId: page.id,
        contactId: contact.id,
        automationId: automation.id,
        direction: 'OUTGOING',
        status: 'SENT',
        body: text,
        commentId: value.comment_id,
        mid: messageId,
        sentAt: new Date(),
      },
    })
    await db.automation.update({ where: { id: automation.id }, data: { sentCount: { increment: 1 } } })
    await db.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
    await recordUsage(automation.userId, 'AUTOMATION_RUN', { type: 'COMMENT_REPLY' })
  } catch (err) {
    const message = err instanceof GraphApiError ? `${err.message} (code ${err.code ?? '-'})` : err instanceof Error ? err.message : 'Unknown send error'
    await db.message
      .create({
        data: {
          userId: automation.userId,
          pageId: page.id,
          contactId: contact.id,
          automationId: automation.id,
          direction: 'OUTGOING',
          status: 'FAILED',
          body: text,
          commentId: `failed:${value.comment_id}`,
          error: message.slice(0, 500),
          failedAt: new Date(),
        },
      })
      .catch(() => {})
    await db.automation.update({ where: { id: automation.id }, data: { failedCount: { increment: 1 }, lastError: message.slice(0, 500) } })
    await db.webhookEvent.update({ where: { id: event.id }, data: { status: 'FAILED', processedAt: new Date(), lastError: message.slice(0, 500) } })
  }
}

// ── Messenger (messages / postbacks) ─────────────────────────────────

type PageRef = { id: string; userId: string; fbPageId: string; accessTokenEnc: string; name: string }

async function upsertContactFromMessenger(page: PageRef, senderPsid: string): Promise<{ contact: Contact; isNew: boolean }> {
  const existing = await db.contact.findUnique({
    where: { userId_fbPsid: { userId: page.userId, fbPsid: senderPsid } },
  })
  if (existing) return { contact: existing, isNew: false }
  let profile: { first_name?: string; last_name?: string; name?: string; profile_pic?: string; locale?: string } | null = null
  try {
    profile = await getUserProfileByPsid(decryptSecret(page.accessTokenEnc), senderPsid)
  } catch {
    profile = null
  }
  const contact = await db.contact.upsert({
    where: { userId_fbPsid: { userId: page.userId, fbPsid: senderPsid } },
    create: {
      userId: page.userId,
      pageId: page.id,
      fbPsid: senderPsid,
      name: profile?.name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null,
      firstName: profile?.first_name || null,
      lastName: profile?.last_name || null,
      avatarUrl: profile?.profile_pic || null,
      locale: profile?.locale || null,
      source: 'messenger',
    },
    update: { lastInteractionAt: new Date() },
  })
  return { contact, isNew: true }
}

async function sendAutomationReply(automationId: string, page: PageRef, contact: Contact, text: string, webhookEventId: string, conversationId?: string) {
  await db.automation.update({ where: { id: automationId }, data: { lastRunAt: new Date(), triggeredCount: { increment: 1 } } })
  const pageToken = decryptSecret(page.accessTokenEnc)
  try {
    const { messageId } = await sendMessageToPsid(pageToken, page.fbPageId, contact.fbPsid, clampMessage(text))
    await db.message.create({
      data: {
        userId: page.userId,
        pageId: page.id,
        contactId: contact.id,
        conversationId,
        automationId,
        direction: 'OUTGOING',
        status: 'SENT',
        body: text,
        mid: messageId,
        sentAt: new Date(),
      },
    })
    await db.automation.update({ where: { id: automationId }, data: { sentCount: { increment: 1 } } })
  } catch (err) {
    const message = err instanceof GraphApiError ? `${err.message} (code ${err.code ?? '-'})` : err instanceof Error ? err.message : 'Unknown send error'
    await db.automation.update({ where: { id: automationId }, data: { failedCount: { increment: 1 }, lastError: message.slice(0, 500) } })
    await db.webhookEvent.update({ where: { id: webhookEventId }, data: { status: 'FAILED', processedAt: new Date(), lastError: message.slice(0, 500) } }).catch(() => {})
  }
}

async function handleMessaging(event: WebhookEvent, item: MetaMessagingItem) {
  const settings = await getPlatformSettings()
  const fbPageId = item.recipient?.id || event.fbPageId
  if (!fbPageId) return
  const page = await resolvePage(fbPageId)
  if (!page || !event.pageId) return
  const pageRef: PageRef = { id: page.id, userId: page.userId, fbPageId: page.fbPageId, accessTokenEnc: page.accessTokenEnc, name: page.name }

  // Deliveries & reads — update message statuses; no replies.
  if (item.delivery && item.delivery.mids) {
    await db.message.updateMany({
      where: { mid: { in: item.delivery.mids }, status: { in: ['SENT', 'QUEUED'] } },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    })
    await db.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
    return
  }
  if (item.read && item.read.watermark) {
    await db.message.updateMany({
      where: { pageId: page.id, sentAt: { lte: new Date(item.read.watermark) }, status: { in: ['SENT', 'DELIVERED'] } },
      data: { status: 'READ', readAt: new Date() },
    })
    await db.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
    return
  }

  const senderPsid = item.sender?.id
  if (!senderPsid) return
  // Loop protection: ignore echoes (our own sends) and Page-originated items.
  if (item.message?.is_echo) return
  if (senderPsid === page.fbPageId) return
  if (item.message?.is_removed) return

  const { contact, isNew } = await upsertContactFromMessenger(pageRef, senderPsid)

  // An inbound message/postback opens the standard messaging window.
  await openMessagingWindow(contact.id, settings.messagingWindowHours)

  const conversation = await db.conversation.upsert({
    where: { pageId_contactId: { pageId: page.id, contactId: contact.id } },
    create: { userId: page.userId, pageId: page.id, contactId: contact.id, lastMessageAt: new Date() },
    update: { lastMessageAt: new Date() },
  })

  const inboundText = item.message?.text || item.postback?.title || ''
  await db.message
    .create({
      data: {
        userId: page.userId,
        pageId: page.id,
        contactId: contact.id,
        conversationId: conversation.id,
        direction: 'INCOMING',
        status: 'RECEIVED',
        body: inboundText,
        mid: item.message?.mid || null,
        metadata: { postback: item.postback?.payload ?? null, quickReply: item.message?.quick_reply?.payload ?? null } as never,
      },
    })
    .catch(() => {
      /* duplicate mid from a replayed webhook */
    })

  // Welcome message on the FIRST interaction only.
  const welcome: Automation | null = await db.automation.findUnique({ where: { pageId_type: { pageId: page.id, type: 'WELCOME_MESSAGE' } } })
  if (welcome && welcome.status === 'ACTIVE' && isNew) {
    await sendAutomationReply(
      welcome.id,
      pageRef,
      contact,
      renderTemplate(welcome.replyTemplate || 'Hello {{first_name}}! 👋 Welcome to our page. How can we help you today?', { first_name: contact.firstName, full_name: contact.name, page_name: page.name }),
      event.id,
      conversation.id
    )
    await recordUsage(page.userId, 'AUTOMATION_RUN', { type: 'WELCOME_MESSAGE' })
  }

  // Default/keyword reply — only for actual text messages, not postbacks/quick replies.
  const defaultReply = await db.automation.findUnique({
    where: { pageId_type: { pageId: page.id, type: 'DEFAULT_REPLY' } },
    include: { rules: true },
  })
  if (defaultReply && defaultReply.status === 'ACTIVE' && item.message?.text && !item.message.quick_reply) {
    const { matched } = keywordMatches(item.message.text, defaultReply.rules.filter((r) => r.isActive))
    let body: string | null = null
    if (matched) body = defaultReply.replyTemplate
    else if (defaultReply.fallbackReply && defaultReply.matchMode === 'keywords+fallback') body = defaultReply.fallbackReply
    if (body) {
      await sendAutomationReply(
        defaultReply.id,
        pageRef,
        contact,
        renderTemplate(body, { first_name: contact.firstName, full_name: contact.name, page_name: page.name }),
        event.id,
        conversation.id
      )
      await recordUsage(page.userId, 'AUTOMATION_RUN', { type: 'DEFAULT_REPLY' })
    }
  }

  await db.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
}

// ── Entry point ──────────────────────────────────────────────────────

export async function processWebhookEvent(webhookEventId: string): Promise<void> {
  const event = await db.webhookEvent.findUnique({ where: { id: webhookEventId } })
  if (!event) return
  if (event.status === 'PROCESSED') return
  if (event.status === 'PROCESSING' && Date.now() - event.receivedAt.getTime() < 60_000) return
  await db.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSING', processAttempts: { increment: 1 } } })

  const payload = event.payload as unknown as {
    entry: { id: string; time?: number; changes?: { field: string; value: Record<string, unknown> }[]; messaging?: MetaMessagingItem[] }[]
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'feed') await handleFeedChange(event, change)
      }
      for (const item of entry.messaging ?? []) {
        await handleMessaging(event, item)
      }
    }
    // Anything not consumed by an automation is still a successfully received event.
    await db.webhookEvent.updateMany({
      where: { id: event.id, status: 'PROCESSING' },
      data: { status: 'PROCESSED', processedAt: new Date() },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error'
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: 'FAILED', lastError: message.slice(0, 500) },
    })
    throw err // let BullMQ retry
  }
}

/** DB-backed sweep for events that never got queued (Redis outage resilience). */
export async function sweepPendingEvents(limit = 25): Promise<number> {
  const stale = await db.webhookEvent.findMany({
    where: { status: 'PENDING', receivedAt: { lt: new Date(Date.now() - 15_000) } },
    orderBy: { receivedAt: 'asc' },
    take: limit,
  })
  for (const ev of stale) {
    try {
      await processWebhookEvent(ev.id)
    } catch {
      /* processWebhookEvent records the failure */
    }
  }
  return stale.length
}
