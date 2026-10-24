import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { subscribePageToApp, unsubscribePageFromApp, getPageDetails, GraphApiError } from '@/lib/meta/client'
import { audit } from '@/lib/audit'

const patchSchema = z.object({
  action: z.enum(['sync', 'resubscribe_webhook', 'mark_token_expired']),
})

async function loadOwnedPage(pageId: string, userId: string) {
  const page = await db.facebookPage.findFirst({ where: { id: pageId, userId } })
  if (!page) throw Object.assign(new Error('Page not found'), { status: 404 })
  return page
}

/** Sync page details / re-subscribe webhooks / mark token state. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const body = await parseBody(req, patchSchema)
    const page = await loadOwnedPage(id, user.id)

    if (body.action === 'mark_token_expired') {
      await db.facebookPage.update({
        where: { id: page.id },
        data: { status: 'TOKEN_EXPIRED', lastError: 'Marked as expired — reconnect required.' },
      })
      return jsonOk({ status: 'TOKEN_EXPIRED' })
    }

    // sync + resubscribe both verify the stored token against the Graph API.
    if (page.status === 'DISCONNECTED') {
      return jsonError('This Page is disconnected. Reconnect Facebook to restore access.', 400, 'DISCONNECTED')
    }

    const token = decryptSecret(page.accessTokenEnc)
    try {
      const details = await getPageDetails(token, page.fbPageId)
      let webhookSubscribed = page.webhookSubscribed
      let webhookError: string | null = null
      try {
        const sub = await subscribePageToApp(token, page.fbPageId)
        webhookSubscribed = Boolean(sub.success)
      } catch (err) {
        webhookSubscribed = false
        webhookError = err instanceof GraphApiError ? err.message : 'Webhook subscription failed'
      }
      const updated = await db.facebookPage.update({
        where: { id: page.id },
        data: {
          name: details.name || page.name,
          category: details.category ?? page.category,
          status: 'CONNECTED',
          webhookSubscribed,
          lastError: webhookError,
          lastSyncedAt: new Date(),
        },
      })
      await audit({ actor: user, action: 'page.sync', targetType: 'FacebookPage', targetId: page.id, metadata: { fbPageId: page.fbPageId } })
      return jsonOk({
        page: { id: updated.id, name: updated.name, status: updated.status, webhookSubscribed: updated.webhookSubscribed, lastSyncedAt: updated.lastSyncedAt },
      })
    } catch (err) {
      const message = err instanceof GraphApiError ? err.message : 'Sync failed'
      const status = err instanceof GraphApiError && err.isTokenError ? 'TOKEN_EXPIRED' : 'ERROR'
      await db.facebookPage.update({ where: { id: page.id }, data: { status, lastError: message.slice(0, 500) } })
      return jsonError(
        status === 'TOKEN_EXPIRED'
          ? 'The Page access token is no longer valid. Reconnect this Page to restore automations.'
          : `Sync failed: ${message}`,
        502,
        status
      )
    }
  } catch (err) {
    return handleApiError(err)
  }
}

/** Disconnect a Page: unsubscribe webhooks, destroy the stored token, keep history. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const page = await loadOwnedPage(id, user.id)

    if (page.status === 'CONNECTED') {
      try {
        await unsubscribePageFromApp(decryptSecret(page.accessTokenEnc), page.fbPageId)
      } catch {
        // Page may already be unsubscribed or token invalid; proceed with local disconnect.
      }
    }

    // Destroy the encrypted token but keep the row so contacts/messages keep their history.
    await db.facebookPage.update({
      where: { id: page.id },
      data: {
        status: 'DISCONNECTED',
        accessTokenEnc: encryptSecret(''),
        webhookSubscribed: false,
        webhookFields: null,
        lastError: null,
      },
    })
    await db.automation.updateMany({ where: { pageId: page.id }, data: { status: 'PAUSED' } })
    await audit({ actor: user, action: 'page.disconnect', targetType: 'FacebookPage', targetId: page.id, metadata: { fbPageId: page.fbPageId } })
    return jsonOk({ disconnected: true })
  } catch (err) {
    return handleApiError(err)
  }
}
