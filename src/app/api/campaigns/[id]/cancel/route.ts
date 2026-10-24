import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'
import { audit } from '@/lib/audit'

/** Cancel a scheduled/sending campaign. Pending recipients are cancelled too. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const campaign = await db.campaign.findFirst({ where: { id, userId: user.id } })
    if (!campaign) return jsonError('Campaign not found.', 404, 'NOT_FOUND')
    if (!['SCHEDULED', 'SENDING', 'LAUNCHING', 'DRAFT'].includes(campaign.status)) {
      return jsonError(`A ${campaign.status.toLowerCase()} campaign cannot be cancelled.`, 400, 'NOT_CANCELLABLE')
    }

    await db.$transaction([
      db.campaign.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      }),
      db.campaignRecipient.updateMany({
        where: { campaignId: id, status: { in: ['PENDING', 'QUEUED'] } },
        data: { status: 'CANCELLED', skipReason: 'campaign_cancelled' },
      }),
    ])
    await audit({ actor: user, action: 'campaign.cancel', targetType: 'Campaign', targetId: id, metadata: { name: campaign.name } })
    return jsonOk({ cancelled: true })
  } catch (err) {
    return handleApiError(err)
  }
}
