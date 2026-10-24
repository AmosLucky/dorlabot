import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'

function parseRange(url: URL): { from: Date; to: Date } {
  const now = new Date()
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  let to = toParam ? new Date(toParam) : now
  if (Number.isNaN(to.getTime())) to = now
  let from: Date
  if (fromParam) {
    from = new Date(fromParam)
    if (Number.isNaN(from.getTime())) from = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  } else {
    from = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  }
  return { from, to: new Date(to.getTime() + 24 * 3600 * 1000) }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { from, to } = parseRange(new URL(req.url))

    const [messages, clickRows, uniqueContacts] = await Promise.all([
      db.message.findMany({
        where: { userId: user.id, direction: 'OUTGOING', createdAt: { gte: from, lte: to } },
        select: { status: true },
      }),
      db.linkClick.findMany({
        where: { link: { userId: user.id }, occurredAt: { gte: from, lte: to } },
        select: { contactId: true },
      }),
      db.message.findMany({
        where: { userId: user.id, direction: 'OUTGOING', status: { in: ['SENT', 'DELIVERED', 'READ'] }, createdAt: { gte: from, lte: to }, contactId: { not: null } },
        select: { contactId: true },
        distinct: ['contactId'],
      }),
    ])

    const clicks = clickRows.length
    const uniqueClickers = new Set(clickRows.filter((c) => c.contactId).map((c) => c.contactId)).size

    const sent = messages.filter((m) => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length
    const delivered = messages.filter((m) => ['DELIVERED', 'READ'].includes(m.status)).length
    const read = messages.filter((m) => m.status === 'READ').length
    const failed = messages.filter((m) => m.status === 'FAILED').length
    const skipped = messages.filter((m) => m.status === 'SKIPPED').length

    // CTR definition: unique tracked clickers / delivered messages × 100.
    // If delivery events are unavailable, the denominator is labeled honestly.
    const { calcCtr } = await import('@/lib/analytics')
    const { ctr, denominator: ctrDenominator } = calcCtr(uniqueClickers, delivered, sent)

    return jsonOk({
      range: { from, to },
      automationEvents: sent + failed + skipped,
      attempted: messages.length,
      sent,
      delivered,
      read,
      failed,
      skipped,
      uniqueContactsReached: uniqueContacts.length,
      clicks,
      uniqueClickers,
      ctr: ctr !== null ? Number(ctr.toFixed(2)) : null,
      ctrDenominator,
      deliveryEventsAvailable: delivered > 0,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
