import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseIntParam } from '@/lib/api'

/** Message activity feed (tenant-scoped). */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const url = new URL(req.url)
    const page = parseIntParam(url.searchParams.get('page'), 1, 1000)
    const perPage = parseIntParam(url.searchParams.get('perPage'), 25, 100)
    const direction = url.searchParams.get('direction') || ''
    const status = url.searchParams.get('status') || ''
    const pageId = url.searchParams.get('pageId') || ''
    const q = url.searchParams.get('q')?.trim() || ''

    const where = {
      userId: user.id,
      ...(direction ? { direction: direction as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(pageId ? { pageId } : {}),
      ...(q ? { OR: [{ body: { contains: q, mode: 'insensitive' as never } }, { contact: { name: { contains: q, mode: 'insensitive' as never } } }] } : {}),
    }

    const [total, messages] = await Promise.all([
      db.message.count({ where }),
      db.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          contact: { select: { id: true, name: true } },
          page: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } },
          automation: { select: { id: true, type: true, name: true } },
        },
      }),
    ])

    return jsonOk({
      messages,
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    })
  } catch (err) {
    return handleApiError(err)
  }
}
