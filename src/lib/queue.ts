import { env } from '@/lib/env'

/**
 * BullMQ queues backed by Redis. The webhook route always persists the event
 * to PostgreSQL BEFORE acknowledging; enqueueing is best-effort so that a
 * temporary Redis outage degrades to slower DB-backed sweeps (see workers/sweeper)
 * instead of losing events.
 */

export const QUEUES = {
  metaEvents: 'meta-events',
  campaignSends: 'campaign-sends',
  maintenance: 'maintenance',
} as const

export type MetaEventJob = { webhookEventId: string }
export type CampaignSendJob = { campaignId: string; recipientId: string }
export type MaintenanceJob = { task: 'sweep-pending-events' | 'dispatch-scheduled-campaigns' | 'sync-pages' }

type IoRedis = typeof import('ioredis').default

const globalRedis = globalThis as unknown as { __queueIoRedis?: IoRedis; __queueIoRedisFailed?: boolean }

/** Lazily create the shared ioredis connection (async import keeps bundlers happy). */
export async function redisConnection(): Promise<{ connection: import('ioredis').default } | null> {
  if (!env.redisUrl) return null
  if (globalRedis.__queueIoRedisFailed) return null
  if (globalRedis.__queueIoRedis) return { connection: globalRedis.__queueIoRedis }
  try {
    const IORedis = (await import('ioredis')).default
    const connection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
    globalRedis.__queueIoRedis = connection
    return { connection }
  } catch (err) {
    globalRedis.__queueIoRedisFailed = true
    console.error('[queue] failed to create Redis connection', err)
    return null
  }
}

/** Fire-and-forget enqueue helpers — never block or throw from request handlers. */
export async function enqueueMetaEvent(webhookEventId: string): Promise<boolean> {
  const conn = await redisConnection()
  if (!conn) return false
  try {
    const { Queue } = await import('bullmq')
    const queue = new Queue(QUEUES.metaEvents, { connection: conn.connection })
    await queue.add('process', { webhookEventId } satisfies MetaEventJob, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 500,
      removeOnFail: false,
    })
    return true
  } catch (err) {
    console.error('[queue] enqueueMetaEvent failed', err)
    return false
  }
}

export async function enqueueCampaignRecipient(campaignId: string, recipientId: string): Promise<boolean> {
  const conn = await redisConnection()
  if (!conn) return false
  try {
    const { Queue } = await import('bullmq')
    const queue = new Queue(QUEUES.campaignSends, { connection: conn.connection })
    await queue.add(
      'send',
      { campaignId, recipientId } satisfies CampaignSendJob,
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: false,
        // throughput guard; per-recipient jobs are throttled at queue level
        limiter: { max: 60, duration: 60000 },
      }
    )
    return true
  } catch (err) {
    console.error('[queue] enqueueCampaignRecipient failed', err)
    return false
  }
}

export async function startMaintenanceScheduler(): Promise<boolean> {
  const conn = await redisConnection()
  if (!conn) return false
  try {
    const { Queue } = await import('bullmq')
    const queue = new Queue(QUEUES.maintenance, { connection: conn.connection })
    await queue.add(
      'tick',
      { task: 'sweep-pending-events' } satisfies MaintenanceJob,
      { repeat: { every: 30_000 }, removeOnComplete: 50 }
    )
    await queue.add(
      'tick',
      { task: 'dispatch-scheduled-campaigns' } satisfies MaintenanceJob,
      { repeat: { every: 60_000 }, removeOnComplete: 50 }
    )
    return true
  } catch (err) {
    console.error('[queue] maintenance scheduler failed', err)
    return false
  }
}
