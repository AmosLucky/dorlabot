import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { automationUpsertSchema } from '@/features/automations/schema'
import { audit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const url = new URL(req.url)
    const type = url.searchParams.get('type')
    const pageId = url.searchParams.get('page')
    const automations = await db.automation.findMany({
      where: {
        userId: user.id,
        ...(type ? { type: type as never } : {}),
        ...(pageId ? { pageId } : {}),
      },
      include: {
        page: { select: { id: true, name: true, status: true, fbPageId: true } },
        rules: true,
      },
      orderBy: { updatedAt: 'desc' },
    })
    return jsonOk({ automations })
  } catch (err) {
    return handleApiError(err)
  }
}

const createSchema = automationUpsertSchema

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const body = await parseBody(req, createSchema)

    // Tenant check: the page must belong to this user.
    const page = await db.facebookPage.findFirst({ where: { id: body.pageId, userId: user.id } })
    if (!page) return jsonError('Page not found in your account.', 404, 'PAGE_NOT_FOUND')

    // Plan limit.
    const plan = await db.customerSubscription.findUnique({ where: { userId: user.id }, include: { plan: true } })
    const maxAutomations = plan?.plan?.maxAutomations ?? 3
    const current = await db.automation.count({ where: { userId: user.id } })
    if (current >= maxAutomations) {
      return jsonError(`Your plan allows ${maxAutomations} automation(s). Upgrade your plan to add more.`, 403, 'PLAN_LIMIT')
    }

    const existing = await db.automation.findUnique({
      where: { pageId_type: { pageId: body.pageId, type: body.type } },
    })
    if (existing) {
      return jsonError('This Page already has an automation of this type. Edit it instead.', 409, 'AUTOMATION_EXISTS')
    }

    const automation = await db.automation.create({
      data: {
        userId: user.id,
        pageId: page.id,
        type: body.type,
        name: body.name,
        replyTemplate: body.replyTemplate || null,
        fallbackReply: body.fallbackReply || null,
        matchMode: body.matchMode,
        enabledPosts: body.enabledPosts as never,
        sendWelcomeQuickReplies: body.quickReplies ? (body.quickReplies as never) : undefined,
        status: body.status,
        rules: { create: body.rules.map((r) => ({ keyword: r.keyword, matchType: r.matchType, isActive: r.isActive })) },
      },
      include: { rules: true, page: { select: { name: true } } },
    })
    await audit({ actor: user, action: 'automation.create', targetType: 'Automation', targetId: automation.id, metadata: { type: body.type, page: page.name } })
    return jsonOk({ automation })
  } catch (err) {
    return handleApiError(err)
  }
}
