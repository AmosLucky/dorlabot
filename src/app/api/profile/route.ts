import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  notificationPrefs: z
    .object({
      campaignCompletions: z.boolean().optional(),
      automationFailures: z.boolean().optional(),
      weeklySummary: z.boolean().optional(),
    })
    .optional(),
})

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const body = await parseBody(req, patchSchema)
    const current = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    const prefs = {
      campaignCompletions: false,
      automationFailures: true,
      weeklySummary: false,
      ...((current.notificationPrefs as Record<string, boolean> | null) ?? {}),
      ...(body.notificationPrefs ?? {}),
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        notificationPrefs: prefs as never,
      },
      select: { id: true, name: true, notificationPrefs: true },
    })
    return jsonOk({ user: updated })
  } catch (err) {
    return handleApiError(err)
  }
}
