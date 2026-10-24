import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { verifyPassword, hashPassword, passwordStrengthError } from '@/lib/password'
import { revokeAllSessions, createSession } from '@/lib/auth'
import { audit } from '@/lib/audit'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string(),
})

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) return jsonError('Unauthorized', 401, 'UNAUTHENTICATED')
    const { currentPassword, newPassword } = await parseBody(req, schema)
    const strengthError = passwordStrengthError(newPassword)
    if (strengthError) return jsonError(strengthError, 422, 'WEAK_PASSWORD')

    const user = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id } })
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return jsonError('Your current password is incorrect.', 401, 'INVALID_PASSWORD')
    }

    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } })
    // Revoke every other session, then re-issue for the current browser.
    await revokeAllSessions(user.id)
    await createSession(user.id)
    await audit({ actor: sessionUser, action: 'auth.password_change' })
    return jsonOk({ changed: true, message: 'Password updated. Other sessions were signed out.' })
  } catch (err) {
    return handleApiError(err)
  }
}
