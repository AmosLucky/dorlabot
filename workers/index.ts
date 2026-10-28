/**
 * Persistent background worker (BullMQ).
 * Run with: bun run worker   (or: bun workers/index.ts)
 *
 * Consumes:
 *   - meta-events      → webhook event processing (automation engine)
 *   - campaign-sends   → per-recipient campaign delivery
 *   - maintenance      → repeatable sweeps (pending events, scheduled campaigns)
 *
 * Records failures into BackgroundJobFailure for admin review/retry.
 */

import { Worker, type Job } from 'bullmq'
import { env } from '../src/lib/env'
import { redisConnection, QUEUES, startMaintenanceScheduler } from '../src/lib/queue'
import { processWebhookEvent, sweepPendingEvents } from '../src/server/automation-engine'
import { processCampaignRecipient } from '../src/server/campaign-sender'
import { dispatchCampaign } from '../src/server/campaign-dispatcher'
import { db } from '../src/lib/db'

const conn = await redisConnection()
if (!conn) {
  console.error('[worker] REDIS_URL is not configured — cannot start BullMQ workers.')
  process.exit(1)
}
const { connection } = conn

async function recordFailure(queue: string, job: Job, err: Error) {
  try {
    const attemptsMade = job.attemptsMade
    const failed = attemptsMade >= (job.opts.attempts ?? 1)
    await db.backgroundJobFailure.upsert({
      where: { queue_jobId: { queue, jobId: String(job.id) } },
      create: {
        queue,
        jobId: String(job.id),
        jobName: job.name,
        attempts: attemptsMade,
        error: err.message.slice(0, 1000),
        payload: { ...job.data } as never,
        status: failed ? 'FAILED' : 'RETRYING',
      },
      update: {
        attempts: attemptsMade,
        error: err.message.slice(0, 1000),
        lastFailedAt: new Date(),
        status: failed ? 'FAILED' : 'RETRYING',
      },
    })
  } catch (e) {
    console.error('[worker] failed to record job failure', e)
  }
}

const metaWorker = new Worker(
  QUEUES.metaEvents,
  async (job) => {
    const { webhookEventId } = job.data as { webhookEventId: string }
    await processWebhookEvent(webhookEventId)
  },
  { connection, concurrency: 4 }
)

const campaignWorker = new Worker(
  QUEUES.campaignSends,
  async (job) => {
    const { campaignId, recipientId } = job.data as { campaignId: string; recipientId: string }
    await processCampaignRecipient(campaignId, recipientId)
  },
  { connection, concurrency: 2, limiter: { max: 60, duration: 60_000 } }
)

const maintenanceWorker = new Worker(
  QUEUES.maintenance,
  async (job) => {
    const { task } = job.data as { task: string }
    if (task === 'sweep-pending-events') {
      const n = await sweepPendingEvents()
      if (n > 0) console.log(`[worker] swept ${n} pending webhook events from DB`)
    } else if (task === 'dispatch-scheduled-campaigns') {
      const due = await db.campaign.findMany({
        where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
        select: { id: true },
        take: 10,
      })
      for (const c of due) {
        await dispatchCampaign(c.id)
      }
    }
  },
  { connection, concurrency: 1 }
)

for (const [name, worker] of [
  ['meta-events', metaWorker],
  ['campaign-sends', campaignWorker],
  ['maintenance', maintenanceWorker],
] as const) {
  worker.on('failed', async (job, err) => {
    console.error(`[worker:${name}] job ${job?.id} failed:`, err.message)
    if (job) await recordFailure(name, job, err)
  })
  worker.on('error', (err) => console.error(`[worker:${name}] worker error:`, err.message))
}

async function main() {
  console.log('[worker] starting…')
  const ok = await startMaintenanceScheduler()
  console.log(`[worker] repeatable maintenance jobs ${ok ? 'registered' : 'NOT registered (Redis?)'}`)
  console.log('[worker] ready — meta-events, campaign-sends, maintenance')

  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} received, shutting down…`)
    await Promise.allSettled([metaWorker.close(), campaignWorker.close(), maintenanceWorker.close()])
    await db.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
