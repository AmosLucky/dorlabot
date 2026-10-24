import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'

const TAG_COLORS = ['#7c3aed', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#2563eb', '#c026d3', '#4f46e5']

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const tags = await db.contactTag.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { assignments: true } } },
    })
    return jsonOk({ tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, contactCount: t._count.assignments })) })
  } catch (err) {
    return handleApiError(err)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const body = await parseBody(req, createSchema)
    const existing = await db.contactTag.findUnique({ where: { userId_name: { userId: user.id, name: body.name } } })
    if (existing) return jsonError('A tag with that name already exists.', 409, 'TAG_EXISTS')
    const color = body.color ?? TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
    const tag = await db.contactTag.create({ data: { userId: user.id, name: body.name, color } })
    return jsonOk({ tag })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return jsonError('Missing tag id', 400, 'BAD_REQUEST')
    await db.contactTag.deleteMany({ where: { id, userId: user.id } })
    return jsonOk({ deleted: true })
  } catch (err) {
    return handleApiError(err)
  }
}
