import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { automationUpsertSchema, ruleSchema } from '@/features/automations/schema'
import { audit } from '@/lib/audit'

async function loadOwned(id: string, userId: string) {
  const a = await db.automation.findFirst({ where: { id, userId } })
  if (!a) throw Object.assign(new Error('Automation not found'), { status: 404 })
  return a
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const automation = await db.automation.findFirst({
      where: { id, userId: user.id },
      include: { rules: true, page: { select: { id: true, name: true, status: true } } },
    })
    if (!automation) return jsonError('Automation not found.', 404, 'NOT_FOUND')
    const recentEvents = await db.message.findMany({
      where: { automationId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, body: true, skipReason: true, error: true, createdAt: true, contact: { select: { name: true } } },
    })
    return jsonOk({ automation, recentEvents })
  } catch (err) {
    return handleApiError(err)
  }
}

// Field-level patch schema. The full upsert schema has superRefine refinements,
// which Zod v4 forbids .partial() on — so the merged object is re-validated
// against the complete schema below instead.
const patchSchema = z.object({
  pageId: z.string().min(1).optional(),
  name: z.string().optional(),
  replyTemplate: z.string().optional(),
  fallbackReply: z.string().nullable().optional(),
  matchMode: z.enum(['any', 'keywords', 'keywords+fallback']).optional(),
  enabledPosts: z.array(z.string()).optional(),
  rules: z.array(ruleSchema).optional(),
  quickReplies: z
    .array(z.object({ title: z.string(), payload: z.string().optional() }))
    .nullable()
    .optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const existing = await loadOwned(id, user.id)
    const body = await parseBody(req, patchSchema)

    // Status-only toggle?
    const statusOnly = Object.keys(body).length === 1 && body.status !== undefined
    if (!statusOnly) {
      const merged = {
        pageId: body.pageId ?? existing.pageId,
        type: existing.type,
        name: body.name ?? existing.name,
        replyTemplate: body.replyTemplate ?? existing.replyTemplate ?? '',
        fallbackReply: body.fallbackReply !== undefined ? body.fallbackReply : existing.fallbackReply,
        matchMode: body.matchMode ?? existing.matchMode ?? 'any',
        enabledPosts: body.enabledPosts ?? ((existing.enabledPosts as string[] | null) ?? ['ALL']),
        rules: body.rules ?? (await db.automationRule.findMany({ where: { automationId: id } })).map((r) => ({ id: r.id, keyword: r.keyword, matchType: r.matchType, isActive: r.isActive })),
        quickReplies: body.quickReplies !== undefined ? body.quickReplies : ((existing.sendWelcomeQuickReplies as never) ?? undefined),
      }
      const parsed = automationUpsertSchema.safeParse(merged)
      if (!parsed.success) {
        return handleApiError(parsed.error)
      }
      await db.$transaction(async (tx) => {
        await tx.automation.update({
          where: { id },
          data: {
            name: parsed.data.name,
            replyTemplate: parsed.data.replyTemplate || null,
            fallbackReply: parsed.data.fallbackReply || null,
            matchMode: parsed.data.matchMode,
            enabledPosts: parsed.data.enabledPosts as never,
            sendWelcomeQuickReplies: parsed.data.quickReplies ? (parsed.data.quickReplies as never) : undefined,
            ...(body.status ? { status: body.status } : {}),
          },
        })
        if (parsed.data.rules) {
          await tx.automationRule.deleteMany({ where: { automationId: id } })
          if (parsed.data.rules.length > 0) {
            await tx.automationRule.createMany({
              data: parsed.data.rules.map((r) => ({ automationId: id, keyword: r.keyword, matchType: r.matchType, isActive: r.isActive })),
            })
          }
        }
      })
    } else {
      await db.automation.update({ where: { id }, data: { status: body.status } })
    }

    const updated = await db.automation.findUniqueOrThrow({ where: { id }, include: { rules: true } })
    await audit({
      actor: user,
      action: statusOnly ? 'automation.status' : 'automation.update',
      targetType: 'Automation',
      targetId: id,
      metadata: statusOnly ? { status: body.status } : { name: updated.name },
    })
    return jsonOk({ automation: updated })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { id } = await params
    const existing = await loadOwned(id, user.id)
    await db.automation.delete({ where: { id } })
    await audit({ actor: user, action: 'automation.delete', targetType: 'Automation', targetId: id, metadata: { type: existing.type } })
    return jsonOk({ deleted: true })
  } catch (err) {
    return handleApiError(err)
  }
}
