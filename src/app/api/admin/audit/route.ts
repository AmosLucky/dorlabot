import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { jsonOk, handleApiError, parseIntParam } from '@/lib/api'

/** Admin: audit log with pagination + action filter. */
export async function GET(req: Request) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    const page = parseIntParam(url.searchParams.get('page'), 1, 1000)
    const perPage = parseIntParam(url.searchParams.get('perPage'), 30, 100)
    const action = url.searchParams.get('action')?.trim() || ''

    const where = action ? { action: { contains: action } } : {}
    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { actor: { select: { name: true, email: true, role: true } } },
      }),
    ])
    return jsonOk({ logs, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) })
  } catch (err) {
    return handleApiError(err)
  }
}
