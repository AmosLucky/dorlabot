import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api'

/** CSV export of the customer's contacts (respects current filters). */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim() || ''
    const state = url.searchParams.get('state') || ''
    const pageId = url.searchParams.get('pageId') || ''
    const tagId = url.searchParams.get('tagId') || ''

    const contacts = await db.contact.findMany({
      where: {
        userId: user.id,
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as never } }, { fbPsid: { contains: q } }] } : {}),
        ...(state ? { messagingState: state as never } : {}),
        ...(pageId ? { pageId } : {}),
        ...(tagId ? { tagAssignments: { some: { tagId } } } : {}),
      },
      include: { page: { select: { name: true } }, tagAssignments: { include: { tag: { select: { name: true } } } } },
      orderBy: { lastInteractionAt: 'desc' },
      take: 10000,
    })

    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }

    const rows = [
      ['name', 'psid', 'page', 'messaging_state', 'eligible_until', 'opted_out', 'tags', 'source', 'first_interaction', 'last_interaction', 'notes'],
      ...contacts.map((c) => [
        c.name ?? '',
        c.fbPsid,
        c.page?.name ?? '',
        c.messagingState,
        c.messagingWindowUntil?.toISOString() ?? '',
        c.optedOutAt?.toISOString() ?? '',
        c.tagAssignments.map((t) => t.tag.name).join('|'),
        c.source ?? '',
        c.firstInteractionAt.toISOString(),
        c.lastInteractionAt.toISOString(),
        c.notes ?? '',
      ]),
    ]

    const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
