import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'
import { enqueueMetaEvent } from '@/lib/queue'
import { audit } from '@/lib/audit'

/** Admin: background job failures + recent webhook events + queue health. */
export async function GET() {
  try {
    await requireAdmin()
    const [failedJobs, recentEvents, eventStats] = await Promise.all([
      db.backgroundJobFailure.findMany({ orderBy: { lastFailedAt: 'desc' }, take: 100 }),
      db.webhookEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 50, select: { id: true, field: true, objectType: true, fbPageId: true, status: true, signatureVerified: true, processAttempts: true, lastError: true, receivedAt: true, processedAt: true } }),
      db.webhookEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    return jsonOk({
      failedJobs,
      recentEvents,
      eventStats: Object.fromEntries(eventStats.map((s) => [s.status, s._count._all])),
      redisConfigured: Boolean(process.env.REDIS_URL),
    })
  } catch (err) {
    return handleApiError(err)
  }
}

/** Retry or resolve a failed job. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    const body = (await req.json()) as { jobId?: string; action?: string }
    if (!body.jobId || !['retry', 'resolve'].includes(body.action ?? '')) {
      return jsonError('Provide jobId and action (retry|resolve).', 400, 'BAD_REQUEST')
    }
    const job = await db.backgroundJobFailure.findUnique({ where: { id: body.jobId } })
    if (!job) return jsonError('Job not found.', 404, 'NOT_FOUND')

    if (body.action === 'retry') {
      if (job.queue === 'meta-events' && job.payload && typeof job.payload === 'object' && 'webhookEventId' in (job.payload as object)) {
        const payload = job.payload as { webhookEventId: string }
        const event = await db.webhookEvent.findUnique({ where: { id: payload.webhookEventId } })
        if (event) {
          await db.webhookEvent.update({ where: { id: event.id }, data: { status: 'PENDING' } })
          const enqueued = await enqueueMetaEvent(event.id)
          if (!enqueued) {
            // stays PENDING → the maintenance sweep will pick it up
            return jsonOk({ retried: true, enqueued: false, note: 'Event reset to PENDING; will be processed by the DB sweep.' })
          }
        }
      } else {
        return jsonError('This job type cannot be re-queued automatically. Re-dispatch it from its source (e.g. relaunch the campaign).', 400, 'NOT_RETRYABLE')
      }
    }

    await db.backgroundJobFailure.update({
      where: { id: job.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    })
    await audit({ actor: admin, action: 'admin.job_retry', targetType: 'BackgroundJobFailure', targetId: job.id, metadata: { action: body.action } })
    return jsonOk({ resolved: true })
  } catch (err) {
    return handleApiError(err)
  }
}
