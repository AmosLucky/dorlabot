import { db } from '@/lib/db'
import { getPlatformSettings } from '@/lib/settings'
import type { Contact, Automation, AutomationRule, FacebookPage } from '@prisma/client'

/**
 * Policy-aware eligibility engine.
 *
 * Meta rules encoded here (all configurable via PlatformSetting so operators can
 * adapt to policy updates without code changes):
 *  - A comment private reply is permitted once per comment within the configured
 *    private-reply window (default 7 days).
 *  - Standard messages to a PSID require an open messaging window (24h after the
 *    person's last interaction with the Page).
 *  - Campaigns require an open messaging window per recipient; opted-out and
 *    blocked contacts are always excluded.
 */

export type Decision = { eligible: boolean; reason: string; details?: Record<string, unknown> }

export async function checkPrivateReplyEligibility(params: {
  page: FacebookPage
  automation: Automation
  commentId: string
  postId: string
  commentText: string
  commenterFbUserId: string
  commenterName?: string | null
  commentCreatedTime?: Date | null
}): Promise<Decision> {
  const settings = await getPlatformSettings()
  const { page, automation } = params

  if (automation.status !== 'ACTIVE') return { eligible: false, reason: 'automation_paused' }
  if (page.status !== 'CONNECTED') return { eligible: false, reason: 'page_not_connected' }

  // Never auto-reply to the Page's own comments.
  if (params.commenterFbUserId === page.fbPageId) return { eligible: false, reason: 'comment_by_page' }

  // Private-reply policy window.
  if (params.commentCreatedTime) {
    const windowMs = settings.privateReplyWindowDays * 24 * 3600 * 1000
    if (Date.now() - params.commentCreatedTime.getTime() > windowMs) {
      return { eligible: false, reason: 'outside_private_reply_window', details: { windowDays: settings.privateReplyWindowDays } }
    }
  }

  // Post targeting: either all posts or the configured allow-list.
  const enabledPosts = (automation.enabledPosts as string[] | null) ?? ['ALL']
  if (Array.isArray(enabledPosts) && enabledPosts.length > 0 && !enabledPosts.includes('ALL')) {
    if (!enabledPosts.includes(params.postId)) return { eligible: false, reason: 'post_not_targeted' }
  }

  // Keyword matching.
  const rules = await db.automationRule.findMany({ where: { automationId: automation.id, isActive: true } })
  if (automation.matchMode === 'keywords' && rules.length > 0) {
    const text = (params.commentText || '').toLowerCase().trim()
    const matched = rules.some((r) => {
      const kw = r.keyword.toLowerCase().trim()
      if (!kw) return false
      if (r.matchType === 'EXACT') return text === kw
      if (r.matchType === 'STARTS_WITH') return text.startsWith(kw)
      return text.includes(kw)
    })
    if (!matched) return { eligible: false, reason: 'keyword_not_matched' }
  }

  // Idempotency: one private reply per comment (DB unique constraint is the hard guard).
  const existing = await db.message.findUnique({ where: { commentId: params.commentId } })
  if (existing) {
    return { eligible: false, reason: 'already_replied', details: { status: existing.status } }
  }

  return { eligible: true, reason: 'ok' }
}

export type ContactEligibility = { eligible: boolean; reason: string }

export async function checkContactMessageEligibility(contact: Contact): Promise<ContactEligibility> {
  const settings = await getPlatformSettings()
  if (contact.messagingState === 'OPTED_OUT') return { eligible: false, reason: 'opted_out' }
  if (contact.messagingState === 'BLOCKED') return { eligible: false, reason: 'blocked' }
  if (!contact.fbPsid) return { eligible: false, reason: 'missing_psid' }
  if (settings.requireWindowForCampaigns) {
    if (!contact.messagingWindowUntil || contact.messagingWindowUntil.getTime() < Date.now()) {
      return { eligible: false, reason: 'messaging_window_closed' }
    }
  }
  return { eligible: true, reason: 'ok' }
}

/** Estimate how many contacts match a campaign segment and are currently eligible. */
export async function estimateEligibleAudience(params: { userId: string; tagIds?: string[] }): Promise<{ eligible: number; total: number }> {
  const { userId, tagIds } = params
  const base = {
    userId,
    messagingState: { notIn: ['OPTED_OUT', 'BLOCKED'] as never[] },
    fbPsid: { not: '' },
  }
  let candidateIds: string[] | undefined
  if (tagIds && tagIds.length > 0) {
    const assignments = await db.contactTagAssignment.findMany({
      where: { tagId: { in: tagIds }, contact: { userId } },
      select: { contactId: true },
    })
    candidateIds = [...new Set(assignments.map((a) => a.contactId))]
    if (candidateIds.length === 0) return { eligible: 0, total: 0 }
  }
  const total = await db.contact.count({
    where: { ...base, ...(candidateIds ? { id: { in: candidateIds } } : {}) },
  })
  const settings = await getPlatformSettings()
  let eligible = total
  if (settings.requireWindowForCampaigns) {
    eligible = await db.contact.count({
      where: {
        ...base,
        ...(candidateIds ? { id: { in: candidateIds } } : {}),
        messagingWindowUntil: { gt: new Date() },
      },
    })
  }
  return { eligible, total }
}

/** Update the contact messaging window after an inbound interaction. */
export async function openMessagingWindow(contactId: string, hours = 24): Promise<void> {
  await db.contact.update({
    where: { id: contactId },
    data: {
      messagingWindowUntil: new Date(Date.now() + hours * 3600 * 1000),
      messagingState: 'ELIGIBLE',
      lastInteractionAt: new Date(),
    },
  })
}

export function keywordMatches(text: string, rules: AutomationRule[]): { matched: boolean; rule: AutomationRule | null } {
  const t = (text || '').toLowerCase().trim()
  for (const r of rules) {
    const kw = r.keyword.toLowerCase().trim()
    if (!kw) continue
    if (r.matchType === 'EXACT' && t === kw) return { matched: true, rule: r }
    if (r.matchType === 'STARTS_WITH' && t.startsWith(kw)) return { matched: true, rule: r }
    if (r.matchType === 'CONTAINS' && t.includes(kw)) return { matched: true, rule: r }
  }
  return { matched: false, rule: null }
}
