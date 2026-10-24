import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { audit } from '@/lib/audit'

async function loadOwned(id: string, userId: string) {
  const c = await db.contact.findFirst({ where: { id, userId } })
  if (!c) throw Object.assign(new Error('Contact not found'), { status: 404 })
  return c
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const contact = await db.contact.findFirst({
      where: { id, userId: user.id },
      include: {
        page: { select: { id: true, name: true, fbPageId: true } },
        tagAssignments: { include: { tag: true } },
      },
    })
    if (!contact) return jsonError('Contact not found.', 404, 'NOT_FOUND')
    const messages = await db.message.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, direction: true, status: true, body: true, error: true, skipReason: true,
        campaign: { select: { name: true } }, automation: { select: { type: true } },
        sentAt: true, createdAt: true,
      },
    })
    return jsonOk({ contact: { ...contact, tags: contact.tagAssignments.map((t) => t.tag) }, messages })
  } catch (err) {
    return handleApiError(err)
  }
}

const patchSchema = z.object({
  notes: z.string().max(2000).optional(),
  tagIds: z.array(z.string().max(50)).max(20).optional(),
  optOut: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const contact = await loadOwned(id, user.id)
    const body = await parseBody(req, patchSchema)

    const data: Record<string, unknown> = {}
    if (body.notes !== undefined) data.notes = body.notes
    if (body.optOut !== undefined) {
      data.optedOutAt = body.optOut ? new Date() : null
      data.messagingState = body.optOut ? 'OPTED_OUT' : 'UNKNOWN'
    }
    const updated = await db.contact.update({ where: { id }, data: data as never })

    if (body.tagIds !== undefined) {
      await db.$transaction([
        db.contactTagAssignment.deleteMany({ where: { contactId: id } }),
        ...(body.tagIds.length > 0
          ? [db.contactTagAssignment.createMany({ data: body.tagIds.map((tagId) => ({ contactId: id, tagId })), skipDuplicates: true })]
          : []),
      ])
    }

    await audit({
      actor: user,
      action: body.optOut ? 'contact.optout' : 'contact.update',
      targetType: 'Contact',
      targetId: id,
      metadata: { psid: contact.fbPsid },
    })
    return jsonOk({ contact: updated })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const contact = await loadOwned(id, user.id)
    await db.contact.delete({ where: { id } })
    await audit({ actor: user, action: 'contact.delete', targetType: 'Contact', targetId: id, metadata: { psid: contact.fbPsid } })
    return jsonOk({ deleted: true })
  } catch (err) {
    return handleApiError(err)
  }
}
