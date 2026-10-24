import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { jsonOk, handleApiError } from '@/lib/api'

/** Admin: all connected Pages with owner info (no tokens, ever). */
export async function GET() {
  try {
    await requireAdmin()
    const pages = await db.facebookPage.findMany({
      orderBy: { connectedAt: 'desc' },
      take: 500,
      select: {
        id: true, fbPageId: true, name: true, category: true, status: true,
        webhookSubscribed: true, lastError: true, lastSyncedAt: true, connectedAt: true,
        isSample: true,
        user: { select: { id: true, name: true, email: true, status: true } },
        _count: { select: { automations: true, contacts: true, messages: true, webhookEvents: true } },
      },
    })
    return jsonOk({ pages })
  } catch (err) {
    return handleApiError(err)
  }
}
