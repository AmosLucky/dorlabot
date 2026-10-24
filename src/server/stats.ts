import { db } from '@/lib/db'

/** Aggregation helpers used by dashboard/admin overview pages and APIs. */

export async function getDashboardStats(userId: string) {
  const [
    pages,
    activePages,
    contacts,
    eligibleContacts,
    activeAutomations,
    totalAutomations,
    messagesSent,
    messagesFailed,
    clicks,
    campaigns,
    activeCampaigns,
  ] = await Promise.all([
    db.facebookPage.count({ where: { userId } }),
    db.facebookPage.count({ where: { userId, status: 'CONNECTED' } }),
    db.contact.count({ where: { userId } }),
    db.contact.count({ where: { userId, messagingState: 'ELIGIBLE', messagingWindowUntil: { gt: new Date() } } }),
    db.automation.count({ where: { userId, status: 'ACTIVE' } }),
    db.automation.count({ where: { userId } }),
    db.message.count({ where: { userId, direction: 'OUTGOING', status: { in: ['SENT', 'DELIVERED', 'READ'] } } }),
    db.message.count({ where: { userId, direction: 'OUTGOING', status: 'FAILED' } }),
    db.linkClick.count({ where: { link: { userId } } }),
    db.campaign.count({ where: { userId } }),
    db.campaign.count({ where: { userId, status: { in: ['SCHEDULED', 'SENDING', 'LAUNCHING'] } } }),
  ])

  const recentCampaigns = await db.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, status: true, sentCount: true, totalRecipients: true, eligibleCount: true, createdAt: true },
  })

  const recentMessages = await db.message.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, direction: true, status: true, body: true, createdAt: true, contact: { select: { name: true } }, page: { select: { name: true } } },
  })

  return {
    pages,
    activePages,
    contacts,
    eligibleContacts,
    activeAutomations,
    totalAutomations,
    messagesSent,
    messagesFailed,
    clicks,
    campaigns,
    activeCampaigns,
    recentCampaigns,
    recentMessages,
  }
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>

const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

export async function getMessageTimeseries(userId: string, from: Date, to: Date) {
  const messages = await db.message.findMany({
    where: { userId, createdAt: { gte: from, lte: to }, direction: 'OUTGOING' },
    select: { createdAt: true, status: true },
  })
  const buckets = new Map<string, { sent: number; failed: number; skipped: number }>()
  for (const m of messages) {
    const key = dayStart(m.createdAt).toISOString().slice(0, 10)
    const b = buckets.get(key) ?? { sent: 0, failed: 0, skipped: 0 }
    if (m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'READ') b.sent++
    else if (m.status === 'FAILED') b.failed++
    else if (m.status === 'SKIPPED') b.skipped++
    buckets.set(key, b)
  }
  const out: { date: string; sent: number; failed: number; skipped: number }[] = []
  const cursor = new Date(dayStart(from))
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10)
    out.push({ date: key, ...(buckets.get(key) ?? { sent: 0, failed: 0, skipped: 0 }) })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export async function getAdminStats() {
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    verifiedUsers,
    totalPages,
    connectedPages,
    errorPages,
    totalAutomations,
    activeAutomations,
    totalCampaigns,
    messagesSent,
    messagesFailed,
    failedJobs,
    pendingEvents,
    processedEvents,
    failedEvents,
  ] = await Promise.all([
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.user.count({ where: { role: 'CUSTOMER', status: 'ACTIVE' } }),
    db.user.count({ where: { role: 'CUSTOMER', status: 'SUSPENDED' } }),
    db.user.count({ where: { role: 'CUSTOMER', emailVerifiedAt: { not: null } } }),
    db.facebookPage.count(),
    db.facebookPage.count({ where: { status: 'CONNECTED' } }),
    db.facebookPage.count({ where: { status: { in: ['ERROR', 'TOKEN_EXPIRED'] } } }),
    db.automation.count(),
    db.automation.count({ where: { status: 'ACTIVE' } }),
    db.campaign.count(),
    db.message.count({ where: { direction: 'OUTGOING', status: { in: ['SENT', 'DELIVERED', 'READ'] } } }),
    db.message.count({ where: { direction: 'OUTGOING', status: 'FAILED' } }),
    db.backgroundJobFailure.count({ where: { status: { in: ['FAILED', 'RETRYING'] } } }),
    db.webhookEvent.count({ where: { status: 'PENDING' } }),
    db.webhookEvent.count({ where: { status: 'PROCESSED' } }),
    db.webhookEvent.count({ where: { status: 'FAILED' } }),
  ])

  const recentAudit = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { actor: { select: { name: true, email: true } } },
  })

  const recentUsers = await db.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, email: true, status: true, createdAt: true },
  })

  return {
    totalUsers, activeUsers, suspendedUsers, verifiedUsers,
    totalPages, connectedPages, errorPages,
    totalAutomations, activeAutomations,
    totalCampaigns, messagesSent, messagesFailed,
    failedJobs, pendingEvents, processedEvents, failedEvents,
    recentAudit, recentUsers,
  }
}
