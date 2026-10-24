import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonOk, jsonError, handleApiError, parseBody, enforceRateLimitAsync } from '@/lib/api'
import { consumeToken } from '@/features/auth/tokens'
import { audit } from '@/lib/audit'

const schema = z.object({ token: z.string().min(10).max(200) })

export async function POST(req: Request) {
  try {
    await enforceRateLimitAsync('verify-email')
    const { token } = await parseBody(req, schema)
    const result = await consumeToken({ type: 'EMAIL_VERIFY', token })
    if (!result?.userId) {
      return jsonError('This verification link is invalid or has expired. Request a new one by signing in.', 400, 'INVALID_TOKEN')
    }
    const user = await db.user.update({
      where: { id: result.userId },
      data: { emailVerifiedAt: new Date() },
    })
    await audit({ actorUserId: user.id, actorEmail: user.email, action: 'auth.email_verified' })
    return jsonOk({ verified: true, message: 'Email verified. You can sign in now.' })
  } catch (err) {
    return handleApiError(err)
  }
}
