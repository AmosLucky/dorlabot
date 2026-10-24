import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonOk, jsonError, handleApiError, parseBody, enforceRateLimitAsync } from '@/lib/api'
import { consumeToken } from '@/features/auth/tokens'
import { hashPassword, passwordStrengthError } from '@/lib/password'
import { revokeAllSessions } from '@/lib/auth'
import { audit } from '@/lib/audit'

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string(),
})

export async function POST(req: Request) {
  try {
    await enforceRateLimitAsync('reset-password')
    const { token, password } = await parseBody(req, schema)
    const strengthError = passwordStrengthError(password)
    if (strengthError) return jsonError(strengthError, 422, 'WEAK_PASSWORD')

    const result = await consumeToken({ type: 'PASSWORD_RESET', token })
    if (!result?.userId) {
      return jsonError('This reset link is invalid or has expired. Request a new one.', 400, 'INVALID_TOKEN')
    }
    const user = await db.user.update({
      where: { id: result.userId },
      data: { passwordHash: hashPassword(password), failedLoginCount: 0, lockedUntil: null },
    })
    await revokeAllSessions(user.id)
    await audit({ actorUserId: user.id, actorEmail: user.email, action: 'auth.password_reset', metadata: { stage: 'completed' } })
    return jsonOk({ reset: true, message: 'Password updated. You can sign in with your new password.' })
  } catch (err) {
    return handleApiError(err)
  }
}
