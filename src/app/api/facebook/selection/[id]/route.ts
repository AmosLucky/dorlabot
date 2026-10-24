import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError } from '@/lib/api'

/**
 * Returns the pending OAuth selection's PUBLIC metadata (page names/ids only).
 * Access tokens are never included — they stay in the encrypted server payload.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const selection = await db.pendingPageSelection.findUnique({ where: { id } })
    if (!selection || selection.userId !== user.id || selection.expiresAt < new Date()) {
      return jsonError('This selection has expired. Please reconnect Facebook.', 404, 'SELECTION_EXPIRED')
    }
    const payload = selection.payload as { pages?: { id: string; name: string; category?: string }[] }
    return jsonOk({ pages: payload.pages ?? [] })
  } catch (err) {
    return handleApiError(err)
  }
}
