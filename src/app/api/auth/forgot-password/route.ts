import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonOk, handleApiError, parseBody, enforceRateLimitAsync } from '@/lib/api'
import { RateLimits } from '@/lib/rate-limit'
import { issueToken } from '@/features/auth/tokens'
import { sendEmail, devEmailLinkEnabled } from '@/lib/email'
import { env } from '@/lib/env'
import { audit } from '@/lib/audit'

const schema = z.object({ email: z.string().trim().toLowerCase().min(3).max(200) })

export async function POST(req: Request) {
  try {
    await enforceRateLimitAsync('forgot-password', RateLimits.forgotPassword)
    const { email } = await parseBody(req, schema)

    const user = await db.user.findUnique({ where: { email } })
    // Always return success to prevent account enumeration.
    let devResetUrl: string | undefined
    if (user && user.status === 'ACTIVE') {
      const token = await issueToken({ type: 'PASSWORD_RESET', userId: user.id, identifier: user.email, ttlMs: 30 * 60 * 1000 })
      const resetUrl = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`
      await sendEmail(
        user.email,
        'Reset your DorlaCode password',
        `Hi ${user.name},\n\nA password reset was requested for your account. Open this link within 30 minutes to choose a new password:\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email — your password will not change.`
      )
      if (devEmailLinkEnabled()) devResetUrl = resetUrl
      await audit({ actorUserId: user.id, actorEmail: user.email, action: 'auth.password_reset', metadata: { stage: 'requested' } })
    }

    return jsonOk({
      message: 'If an account exists for that email, a reset link has been sent.',
      devResetUrl,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
