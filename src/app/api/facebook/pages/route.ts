import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { encryptSecret } from '@/lib/crypto'
import { subscribePageToApp, GraphApiError } from '@/lib/meta/client'

/** List the user's connected Pages (never exposes tokens). */
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const pages = await db.facebookPage.findMany({
      where: { userId: user.id },
      orderBy: { connectedAt: 'desc' },
      select: {
        id: true, fbPageId: true, name: true, category: true, status: true,
        webhookSubscribed: true, lastError: true, lastSyncedAt: true, connectedAt: true,
        tokenExpiresAt: true, isSample: true,
        _count: { select: { contacts: true, automations: true, messages: true } },
      },
    })
    return jsonOk({ pages })
  } catch (err) {
    return handleApiError(err)
  }
}

const connectSchema = z.object({
  selectionId: z.string().min(5).max(100),
  pageIds: z.array(z.string().min(1).max(50)).min(1).max(20),
})

/** Connect selected Pages from a pending OAuth selection. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const body = await parseBody(req, connectSchema)

    const selection = await db.pendingPageSelection.findUnique({ where: { id: body.selectionId } })
    if (!selection || selection.userId !== user.id || selection.expiresAt < new Date()) {
      return jsonError('The page selection has expired. Please reconnect Facebook.', 400, 'SELECTION_EXPIRED')
    }

    const plan = await db.customerSubscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    })
    const maxPages = plan?.plan?.maxPages ?? 1
    const currentCount = await db.facebookPage.count({ where: { userId: user.id } })
    const slots = Math.max(0, maxPages - currentCount)
    if (slots === 0) {
      return jsonError(
        `Your plan allows ${maxPages} connected Page(s). Disconnect one or upgrade your plan to add more.`,
        403,
        'PLAN_LIMIT'
      )
    }
    const toConnect = body.pageIds.slice(0, slots)

    const payload = selection.payload as { tokens: Record<string, string> }
    const results: { pageId: string; name?: string; connected: boolean; webhookSubscribed: boolean; error?: string }[] = []

    for (const fbPageId of toConnect) {
      const token = payload.tokens?.[fbPageId]
      if (!token) {
        results.push({ pageId: fbPageId, connected: false, webhookSubscribed: false, error: 'Missing token for page' })
        continue
      }
      let webhookSubscribed = false
      let webhookError: string | undefined
      try {
        const sub = await subscribePageToApp(token, fbPageId)
        webhookSubscribed = Boolean(sub.success)
      } catch (err) {
        webhookError = err instanceof GraphApiError ? err.message : 'Webhook subscription failed'
      }
      const page = await db.facebookPage.upsert({
        where: { userId_fbPageId: { userId: user.id, fbPageId } },
        create: {
          userId: user.id,
          fbPageId,
          name: (selection.payload as { pages?: { id: string; name: string; category?: string }[] }).pages?.find((p) => p.id === fbPageId)?.name ?? `Page ${fbPageId}`,
          category: (selection.payload as { pages?: { id: string; category?: string }[] }).pages?.find((p) => p.id === fbPageId)?.category ?? null,
          accessTokenEnc: encryptSecret(token),
          status: 'CONNECTED',
          webhookSubscribed,
          webhookFields: 'feed,messages,messaging_postbacks,message_deliveries,message_reads',
          lastError: webhookError,
          lastSyncedAt: new Date(),
        },
        update: {
          accessTokenEnc: encryptSecret(token),
          status: 'CONNECTED',
          webhookSubscribed,
          lastError: webhookError,
          lastSyncedAt: new Date(),
        },
      })
      results.push({ pageId: fbPageId, name: page.name, connected: true, webhookSubscribed, error: webhookError })
    }

    await db.pendingPageSelection.delete({ where: { id: selection.id } }).catch(() => {})

    return jsonOk({ results, planLimit: maxPages, remainingSlots: Math.max(0, slots - results.filter((r) => r.connected).length) })
  } catch (err) {
    return handleApiError(err)
  }
}
