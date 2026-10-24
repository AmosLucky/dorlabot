import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'
import { env } from '@/lib/env'
import { decryptSecret } from '@/lib/crypto'

/**
 * Lists recent posts for a connected Page (for comment-automation post targeting).
 * Falls back to an empty list with a reason when the Graph call fails.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const page = await db.facebookPage.findFirst({ where: { id, userId: user.id, status: 'CONNECTED' } })
    if (!page) return jsonError('Page not found or not connected.', 404, 'PAGE_NOT_FOUND')

    if (!env.meta.configured) {
      return jsonOk({ posts: [], reason: 'meta_not_configured' })
    }
    const token = decryptSecret(page.accessTokenEnc)
    const res = await fetch(
      `https://graph.facebook.com/${env.meta.graphApiVersion}/${page.fbPageId}/posts?fields=id,message,created_time,permalink_url&limit=25&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) {
      return jsonOk({ posts: [], reason: 'graph_error' })
    }
    const body = (await res.json()) as { data?: { id: string; message?: string; created_time?: string; permalink_url?: string }[] }
    return jsonOk({
      posts: (body.data ?? []).map((p) => ({
        id: p.id,
        label: p.message ? (p.message.length > 80 ? `${p.message.slice(0, 80)}…` : p.message) : `Post ${p.id}`,
        createdTime: p.created_time,
        url: p.permalink_url,
      })),
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export const dynamic = 'force-dynamic'
