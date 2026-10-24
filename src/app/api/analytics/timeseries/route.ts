import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'

function parseRange(url: URL): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getTime() + 24 * 3600 * 1000)
  const days = parseInt(url.searchParams.get('days') || '30', 10)
  const safeDays = [7, 30, 90].includes(days) ? days : 30
  return { from: new Date(now.getTime() - safeDays * 24 * 3600 * 1000), to }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { from, to } = parseRange(new URL(req.url))

    const [messages, clicks, incoming] = await Promise.all([
      db.message.findMany({
        where: { userId: user.id, direction: 'OUTGOING', createdAt: { gte: from, lte: to } },
        select: { createdAt: true, status: true },
      }),
      db.linkClick.findMany({
        where: { link: { userId: user.id }, occurredAt: { gte: from, lte: to } },
        select: { occurredAt: true },
      }),
      db.message.count({ where: { userId: user.id, direction: 'INCOMING', createdAt: { gte: from, lte: to } } }),
    ])

    const buckets = new Map<string, { sent: number; failed: number; skipped: number; clicks: number }>()
    const dayKey = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10)
    for (const m of messages) {
      const k = dayKey(m.createdAt)
      const b = buckets.get(k) ?? { sent: 0, failed: 0, skipped: 0, clicks: 0 }
      if (['SENT', 'DELIVERED', 'READ'].includes(m.status)) b.sent++
      else if (m.status === 'FAILED') b.failed++
      else if (m.status === 'SKIPPED') b.skipped++
      buckets.set(k, b)
    }
    for (const c of clicks) {
      const k = dayKey(c.occurredAt)
      const b = buckets.get(k) ?? { sent: 0, failed: 0, skipped: 0, clicks: 0 }
      b.clicks++
      buckets.set(k, b)
    }

    const series: { date: string; sent: number; failed: number; skipped: number; clicks: number }[] = []
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
    while (cursor <= to) {
      const k = cursor.toISOString().slice(0, 10)
      series.push({ date: k, ...(buckets.get(k) ?? { sent: 0, failed: 0, skipped: 0, clicks: 0 }) })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return jsonOk({ series, incoming, range: { from, to } })
  } catch (err) {
    return handleApiError(err)
  }
}
