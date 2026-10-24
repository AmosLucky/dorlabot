import { db } from '@/lib/db'
import { decryptSecret, shortSlug } from '@/lib/crypto'
import { sendMessageToPsid, GraphApiError } from '@/lib/meta/client'
import { checkContactMessageEligibility } from '@/lib/eligibility'
import { renderTemplate, clampMessage } from '@/lib/template'

/**
 * Queue-backed campaign delivery.
 * One BullMQ job per recipient; eligibility is re-checked at send time so that
 * opt-outs and closed messaging windows between launch and send are respected.
 */

export async function processCampaignRecipient(campaignId: string, recipientId: string): Promise<void> {
  const recipient = await db.campaignRecipient.findUnique({ where: { id: recipientId }, include: { contact: true, campaign: true } })
  if (!recipient) return
  const { campaign, contact } = recipient
  if (campaign.status !== 'SENDING' && campaign.status !== 'LAUNCHING') return
  if (recipient.status === 'SENT' || recipient.status === 'CANCELLED') return

  const markSkipped = async (reason: string) => {
    await db.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'SKIPPED', skipReason: reason } })
    await db.campaign.update({ where: { id: campaign.id }, data: { skippedCount: { increment: 1 } } })
  }

  // Duplicate-send guard.
  if (recipient.messageId) return

  const eligibility = await checkContactMessageEligibility(contact)
  if (!eligibility.eligible) {
    await markSkipped(eligibility.reason)
    return
  }

  const page = await db.facebookPage.findFirst({ where: { id: contact.pageId ?? '', status: 'CONNECTED' } })
  if (!page) {
    await markSkipped('page_not_connected')
    return
  }

  // Build the tracked link for this recipient if the campaign has a destination URL.
  let trackedLink: string | null = null
  if (campaign.trackedTargetUrl) {
    const existing = await db.trackedLink.findFirst({ where: { campaignId: campaign.id } })
    const link =
      existing ??
      (await db.trackedLink.create({
        data: {
          userId: campaign.userId,
          campaignId: campaign.id,
          slug: shortSlug(10),
          targetUrl: campaign.trackedTargetUrl,
          title: campaign.name,
        },
      }))
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    trackedLink = `${base}/l/${link.slug}?c=${recipient.recipientToken}`
  }

  const text = clampMessage(
    renderTemplate(campaign.body, {
      first_name: contact.firstName,
      last_name: contact.lastName,
      full_name: contact.name,
      page_name: page.name,
      tracked_link: trackedLink,
    })
  )

  try {
    const { messageId } = await sendMessageToPsid(decryptSecret(page.accessTokenEnc), page.fbPageId, contact.fbPsid, text)
    const message = await db.message.create({
      data: {
        userId: campaign.userId,
        pageId: page.id,
        contactId: contact.id,
        campaignId: campaign.id,
        direction: 'OUTGOING',
        status: 'SENT',
        body: text,
        mid: messageId,
        sentAt: new Date(),
      },
    })
    await db.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'SENT', messageId: message.id, sentAt: new Date() },
    })
    await db.campaign.update({ where: { id: campaign.id }, data: { sentCount: { increment: 1 } } })
    await db.usageRecord.create({
      data: { userId: campaign.userId, type: 'CAMPAIGN_MESSAGE', amount: 1, periodKey: new Date().toISOString().slice(0, 7), metadata: { campaignId: campaign.id } },
    })
  } catch (err) {
    const message = err instanceof GraphApiError ? `${err.message} (code ${err.code ?? '-'})` : err instanceof Error ? err.message : 'Unknown send error'
    // Throttling (code 4, 613, 1200) is retryable; let BullMQ backoff handle it.
    const retryable = err instanceof GraphApiError && [4, 613, 1200].includes(err.code ?? -1)
    if (retryable) {
      await db.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'QUEUED', error: message.slice(0, 500) } })
      throw err
    }
    await db.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'FAILED', error: message.slice(0, 500) } })
    await db.campaign.update({ where: { id: campaign.id }, data: { failedCount: { increment: 1 } } })
  } finally {
    await maybeCompleteCampaign(campaign.id)
  }
}

export async function maybeCompleteCampaign(campaignId: string): Promise<void> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true, totalRecipients: true, sentCount: true, failedCount: true, skippedCount: true } })
  if (!campaign || campaign.status !== 'SENDING') return
  if (campaign.sentCount + campaign.failedCount + campaign.skippedCount >= campaign.totalRecipients) {
    await db.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED', completedAt: new Date() } })
  }
}
