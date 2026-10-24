import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { audit } from '@/lib/audit'

async function loadOwned(id: string, userId: string) {
  const c = await db.campaign.findFirst({ where: { id, userId } })
  if (!c) throw Object.assign(new Error('Campaign not found'), { status: 404 })
  return c
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const campaign = await loadOwned(id, user.id)
    const recipients = await db.campaignRecipient.findMany({
      where: { campaignId: id },
      include: { contact: { select: { id: true, name: true, messagingState: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    })
    const trackedLink = await db.trackedLink.findFirst({
      where: { campaignId: id },
      select: { id: true, slug: true, targetUrl: true, clickCount: true, uniqueClickCount: true },
    })
    return jsonOk({
      campaign: {
        ...campaign,
        audienceSegment: campaign.audienceSegment ?? { tagIds: [] },
      },
      recipients,
      trackedLink,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  body: z.string().trim().min(1).max(1900).optional(),
  trackedTargetUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  audienceTagIds: z.array(z.string().max(50)).max(20).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const campaign = await loadOwned(id, user.id)
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      return jsonError('Only draft or scheduled campaigns can be edited.', 400, 'NOT_EDITABLE')
    }
    const body = await parseBody(req, patchSchema)
    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.body ? { body: body.body } : {}),
        ...(body.trackedTargetUrl !== undefined ? { trackedTargetUrl: body.trackedTargetUrl || null } : {}),
        ...(body.audienceTagIds ? { audienceSegment: { tagIds: body.audienceTagIds } as never } : {}),
        ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, status: body.scheduledAt ? 'SCHEDULED' : campaign.status } : {}),
      },
    })
    await audit({ actor: user, action: 'campaign.update', targetType: 'Campaign', targetId: id })
    return jsonOk({ campaign: updated })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const campaign = await loadOwned(id, user.id)
    if (['SENDING', 'LAUNCHING'].includes(campaign.status)) {
      return jsonError('Cancel the campaign before deleting it.', 400, 'STILL_SENDING')
    }
    await db.campaign.delete({ where: { id } })
    await audit({ actor: user, action: 'campaign.delete', targetType: 'Campaign', targetId: id })
    return jsonOk({ deleted: true })
  } catch (err) {
    return handleApiError(err)
  }
}
