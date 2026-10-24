import { jsonOk, handleApiError } from '@/lib/api'
import { requireUser, getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { sha256Hex } from '@/lib/crypto'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const user = await requireUser()
    const jar = await cookies()
    const currentHash = jar.get('dorla_session')?.value ? sha256Hex(jar.get('dorla_session')!.value) : ''
    const sessions = await db.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true, tokenHash: true },
    })
    return jsonOk({
      sessions: sessions.map((s) => ({
        id: s.id,
        ip: s.ip,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        current: s.tokenHash === currentHash,
      })),
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return handleApiError(new Error('Unauthorized'))
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const all = url.searchParams.get('all')
    if (all === '1') {
      await db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
      return jsonOk({ revoked: 'all' })
    }
    if (id) {
      await db.session.updateMany({ where: { id, userId: user.id }, data: { revokedAt: new Date() } })
      return jsonOk({ revoked: id })
    }
    return jsonOk({ revoked: null })
  } catch (err) {
    return handleApiError(err)
  }
}
