import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseIntParam } from '@/lib/api'
import { audit } from '@/lib/audit'

/** Contact list — tenant-scoped, searchable, filterable, paginated. */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const url = new URL(req.url)
    const page = parseIntParam(url.searchParams.get('page'), 1, 1000)
    const perPage = parseIntParam(url.searchParams.get('perPage'), 20, 100)
    const q = url.searchParams.get('q')?.trim() || ''
    const state = url.searchParams.get('state') || ''
    const pageId = url.searchParams.get('pageId') || ''
    const tagId = url.searchParams.get('tagId') || ''
    const sort = url.searchParams.get('sort') || 'lastInteraction'

    const where = {
      userId: user.id,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as never } }, { fbPsid: { contains: q } }] } : {}),
      ...(state ? { messagingState: state as never } : {}),
      ...(pageId ? { pageId } : {}),
      ...(tagId ? { tagAssignments: { some: { tagId } } } : {}),
    }

    const orderBy =
      sort === 'name' ? { name: 'asc' as never } : sort === 'firstSeen' ? { firstInteractionAt: 'desc' as never } : { lastInteractionAt: 'desc' as never }

    const [total, contacts] = await Promise.all([
      db.contact.count({ where }),
      db.contact.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          page: { select: { id: true, name: true } },
          tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
          _count: { select: { messages: true } },
        },
      }),
    ])

    return jsonOk({
      contacts: contacts.map((c) => ({
        id: c.id,
        fbPsid: c.fbPsid,
        name: c.name,
        firstName: c.firstName,
        source: c.source,
        messagingState: c.messagingState,
        messagingWindowUntil: c.messagingWindowUntil,
        optedOutAt: c.optedOutAt,
        notes: c.notes,
        isSample: c.isSample,
        firstInteractionAt: c.firstInteractionAt,
        lastInteractionAt: c.lastInteractionAt,
        page: c.page,
        tags: c.tagAssignments.map((t) => t.tag),
        messageCount: c._count.messages,
      })),
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    })
  } catch (err) {
    return handleApiError(err)
  }
}

// `audit` imported for API symmetry; listing is not audit-logged.
void audit
