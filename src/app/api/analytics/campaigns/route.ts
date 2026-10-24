import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'
import { calcCtr } from '@/lib/analytics'

/** Per-campaign comparison with honest CTR denominators. */
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')

    const campaigns = await db.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, name: true, status: true, totalRecipients: true, eligibleCount: true,
        sentCount: true, failedCount: true, skippedCount: true, createdAt: true, completedAt: true,
        messages: { select: { status: true } },
        trackedLinks: { select: { id: true, clickCount: true, uniqueClickCount: true } },
      },
    })

    return jsonOk({
      campaigns: campaigns.map((c) => {
        const delivered = c.messages.filter((m) => ['DELIVERED', 'READ'].includes(m.status)).length
        const sent = c.messages.filter((m) => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length
        const uniqueClickers = c.trackedLinks.reduce((sum, l) => sum + l.uniqueClickCount, 0)
        const clicks = c.trackedLinks.reduce((sum, l) => sum + l.clickCount, 0)
        const { ctr, denominator: ctrDenominator } = calcCtr(uniqueClickers, delivered, sent)
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          createdAt: c.createdAt,
          totalRecipients: c.totalRecipients,
          eligibleCount: c.eligibleCount,
          sentCount: c.sentCount,
          failedCount: c.failedCount,
          skippedCount: c.skippedCount,
          delivered,
          clicks,
          uniqueClickers,
          ctr: ctr !== null ? Number(ctr.toFixed(2)) : null,
          ctrDenominator,
        }
      }),
    })
  } catch (err) {
    return handleApiError(err)
  }
}
