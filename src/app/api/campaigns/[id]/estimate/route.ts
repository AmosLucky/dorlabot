import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'
import { estimateEligibleAudience } from '@/lib/eligibility'

/** Pre-launch audience estimate: eligible vs total for this campaign's segment. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const campaign = await db.campaign.findFirst({ where: { id, userId: user.id } })
    if (!campaign) return jsonError('Campaign not found.', 404, 'NOT_FOUND')

    const segment = (campaign.audienceSegment as { tagIds?: string[] } | null) ?? {}
    const { eligible, total } = await estimateEligibleAudience({ userId: user.id, tagIds: segment.tagIds ?? [] })
    await db.campaign.update({ where: { id }, data: { eligibleCount: eligible, totalRecipients: total } })
    return jsonOk({
      eligible,
      total,
      note:
        eligible === 0
          ? 'No recipients are currently eligible. Contacts need an open messaging window (they messaged your Page within the last 24 hours) and must not be opted out.'
          : undefined,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return POST(_req as unknown as Request, { params })
}
