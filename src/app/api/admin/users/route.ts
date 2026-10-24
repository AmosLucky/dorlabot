import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseIntParam } from '@/lib/api'
import { audit } from '@/lib/audit'

/** ── Admin: user management ─────────────────────────────────────────── */

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    const page = parseIntParam(url.searchParams.get('page'), 1, 1000)
    const perPage = parseIntParam(url.searchParams.get('perPage'), 20, 100)
    const q = url.searchParams.get('q')?.trim() || ''
    const status = url.searchParams.get('status') || ''

    const where = {
      role: 'CUSTOMER' as never,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as never } }, { email: { contains: q, mode: 'insensitive' as never } }] } : {}),
      ...(status ? { status: status as never } : {}),
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, name: true, email: true, status: true, role: true, emailVerifiedAt: true,
          createdAt: true, lastLoginAt: true, twoFactorEnabled: true, demoData: true,
          _count: { select: { pages: true, contacts: true, campaigns: true, messages: true } },
        },
      }),
    ])
    return jsonOk({ users, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin()
    const { z } = await import('zod')
    const schema = z.object({
      userId: z.string().min(1),
      action: z.enum(['suspend', 'reactivate']),
      reason: z.string().max(500).optional(),
    })
    const body = schema.parse(await req.json())

    const target = await db.user.findFirst({ where: { id: body.userId, role: 'CUSTOMER' } })
    if (!target) return jsonError('Customer not found.', 404, 'NOT_FOUND')

    if (body.action === 'suspend') {
      await db.user.update({
        where: { id: target.id },
        data: { status: 'SUSPENDED', suspendedAt: new Date(), suspendedReason: body.reason ?? 'Suspended by administrator' },
      })
      await db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } })
      await db.automation.updateMany({ where: { userId: target.id, status: 'ACTIVE' }, data: { status: 'PAUSED' } })
    } else {
      await db.user.update({
        where: { id: target.id },
        data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
      })
    }

    await audit({
      actor: admin,
      action: body.action === 'suspend' ? 'admin.user_suspend' : 'admin.user_reactivate',
      targetType: 'User',
      targetId: target.id,
      metadata: { email: target.email, reason: body.reason ?? null },
    })
    return jsonOk({ userId: target.id, status: body.action === 'suspend' ? 'SUSPENDED' : 'ACTIVE' })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin()
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return jsonError('Missing userId', 400, 'BAD_REQUEST')
    const target = await db.user.findFirst({ where: { id: userId, role: 'CUSTOMER' } })
    if (!target) return jsonError('Customer not found.', 404, 'NOT_FOUND')

    // Hard delete cascades to sessions, pages, automations, contacts, campaigns…
    await db.user.delete({ where: { id: target.id } })
    await audit({ actor: admin, action: 'admin.user_delete', targetType: 'User', targetId: target.id, metadata: { email: target.email } })
    return jsonOk({ deleted: true })
  } catch (err) {
    return handleApiError(err)
  }
}
