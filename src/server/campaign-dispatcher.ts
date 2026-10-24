import { db } from '@/lib/db'
import { enqueueCampaignRecipient } from '@/lib/queue'
import { checkContactMessageEligibility } from '@/lib/eligibility'

/**
 * Campaign dispatch: re-validates audience eligibility at launch time and
 * enqueues one durable job per eligible recipient. Never sends synchronously
 * from an HTTP request.
 */

export async function dispatchCampaign(campaignId: string): Promise<{ queued: number; skipped: number }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campaign not found')
  if (!['SCHEDULED', 'DRAFT', 'LAUNCHING'].includes(campaign.status)) {
    throw new Error(`Campaign cannot be dispatched from status ${campaign.status}`)
  }

  await db.campaign.update({ where: { id: campaign.id }, data: { status: 'SENDING', startedAt: campaign.startedAt ?? new Date() } })

  const segment = (campaign.audienceSegment as { tagIds?: string[] } | null) ?? {}
  const tagIds = segment.tagIds ?? []

  const baseWhere = {
    userId: campaign.userId,
    messagingState: { notIn: ['OPTED_OUT', 'BLOCKED'] as never[] },
    fbPsid: { not: '' },
    ...(tagIds.length > 0
      ? { tagAssignments: { some: { tagId: { in: tagIds } } } }
      : {}),
  }

  const contacts = await db.contact.findMany({
    where: baseWhere,
    select: { id: true, messagingWindowUntil: true, messagingState: true, optedOutAt: true, fbPsid: true },
    orderBy: { lastInteractionAt: 'desc' },
  })

  let queued = 0
  let skipped = 0
  for (const contact of contacts) {
    // Recreate a minimal Contact-shaped object for the eligibility check.
    const eligibility = await checkContactMessageEligibility({
      ...contact,
      messagingState: contact.messagingState,
      optedOutAt: contact.optedOutAt,
    } as never)
    if (!eligibility.eligible) {
      await db.campaignRecipient.upsert({
        where: { campaignId_contactId: { campaignId: campaign.id, contactId: contact.id } },
        create: {
          campaignId: campaign.id,
          contactId: contact.id,
          status: 'SKIPPED',
          skipReason: eligibility.reason,
          recipientToken: crypto.randomUUID(),
        },
        update: { status: 'SKIPPED', skipReason: eligibility.reason },
      })
      skipped++
      continue
    }
    const recipient = await db.campaignRecipient.upsert({
      where: { campaignId_contactId: { campaignId: campaign.id, contactId: contact.id } },
      create: {
        campaignId: campaign.id,
        contactId: contact.id,
        status: 'QUEUED',
        recipientToken: crypto.randomUUID(),
      },
      update: { status: 'QUEUED', error: null, skipReason: null },
    })
    const enqueued = await enqueueCampaignRecipient(campaign.id, recipient.id)
    if (!enqueued) {
      await db.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'PENDING' } })
    }
    queued++
  }

  if (skipped > 0) {
    await db.campaign.update({ where: { id: campaign.id }, data: { skippedCount: { increment: skipped } } })
  }
  await db.campaign.update({
    where: { id: campaign.id },
    data: { totalRecipients: queued + skipped, eligibleCount: queued },
  })
  return { queued, skipped }
}
