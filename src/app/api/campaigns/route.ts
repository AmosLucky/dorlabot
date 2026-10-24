import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { estimateEligibleAudience } from '@/lib/eligibility'
import { audit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || ''
    const campaigns = await db.campaign.findMany({
      where: { userId: user.id, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, status: true, totalRecipients: true, eligibleCount: true,
        sentCount: true, failedCount: true, skippedCount: true, scheduledAt: true,
        startedAt: true, completedAt: true, createdAt: true, isSample: true,
      },
    })
    return jsonOk({ campaigns })
  } catch (err) {
    return handleApiError(err)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'Campaign name is required').max(120),
  body: z.string().trim().min(1, 'Message content is required').max(1900),
  trackedTargetUrl: z.string().trim().url('Enter a valid URL (https://…)').max(500).optional().or(z.literal('')),
  audienceTagIds: z.array(z.string().max(50)).max(20).default([]),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const body = await parseBody(req, createSchema)

    const { eligible, total } = await estimateEligibleAudience({ userId: user.id, tagIds: body.audienceTagIds })

    const campaign = await db.campaign.create({
      data: {
        userId: user.id,
        name: body.name,
        body: body.body,
        trackedTargetUrl: body.trackedTargetUrl || null,
        audienceSegment: { tagIds: body.audienceTagIds } as never,
        status: body.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        eligibleCount: eligible,
        totalRecipients: total,
      },
    })
    await audit({ actor: user, action: 'campaign.create', targetType: 'Campaign', targetId: campaign.id, metadata: { name: body.name } })
    return jsonOk({ campaign })
  } catch (err) {
    return handleApiError(err)
  }
}
