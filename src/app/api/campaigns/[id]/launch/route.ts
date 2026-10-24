import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'
import { dispatchCampaign } from '@/server/campaign-dispatcher'
import { estimateEligibleAudience } from '@/lib/eligibility'
import { audit } from '@/lib/audit'

/**
 * Launch a campaign: re-estimates eligibility, persists an audit entry, and
 * enqueues one durable job per eligible recipient (never a synchronous blast).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const campaign = await db.campaign.findFirst({ where: { id, userId: user.id } })
    if (!campaign) return jsonError('Campaign not found.', 404, 'NOT_FOUND')
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      return jsonError(`This campaign is ${campaign.status.toLowerCase()} and cannot be launched again.`, 400, 'NOT_LAUNCHABLE')
    }
    if (!campaign.body.trim()) {
      return jsonError('The campaign message is empty.', 400, 'EMPTY_BODY')
    }

    const segment = (campaign.audienceSegment as { tagIds?: string[] } | null) ?? {}
    const { eligible } = await estimateEligibleAudience({ userId: user.id, tagIds: segment.tagIds ?? [] })
    if (eligible === 0) {
      return jsonError(
        'No eligible recipients right now. Contacts need an open messaging window and must not be opted out. Eligibility is re-checked at launch to comply with Meta rules.',
        400,
        'NO_ELIGIBLE_AUDIENCE'
      )
    }

    await db.campaign.update({ where: { id }, data: { status: 'LAUNCHING' } })
    try {
      const { queued, skipped } = await dispatchCampaign(id)
      await audit({
        actor: user,
        action: 'campaign.launch',
        targetType: 'Campaign',
        targetId: id,
        metadata: { name: campaign.name, queued, skipped },
      })
      return jsonOk({ queued, skipped, message: `Campaign launched: ${queued} recipient job(s) queued for delivery.` })
    } catch (err) {
      await db.campaign.update({ where: { id }, data: { status: 'FAILED', lastError: err instanceof Error ? err.message : 'Dispatch failed' } })
      throw err
    }
  } catch (err) {
    return handleApiError(err)
  }
}
