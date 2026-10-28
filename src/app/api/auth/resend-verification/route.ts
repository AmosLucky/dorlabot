import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonOk, handleApiError, parseBody, enforceRateLimitAsync } from '@/lib/api'
import { RateLimits } from '@/lib/rate-limit'
import { issueToken } from '@/features/auth/tokens'
import { sendEmail } from '@/lib/email'
import { env } from '@/lib/env'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
})

export async function POST(req: Request) {
  try {
    await enforceRateLimitAsync('resend-verification', RateLimits.resendVerification)
    const { email } = await parseBody(req, schema)
    const user = await db.user.findUnique({ where: { email } })
    let devVerifyUrl: string | undefined

    if (user && user.status === 'ACTIVE' && !user.emailVerifiedAt) {
      const token = await issueToken({
        type: 'EMAIL_VERIFY',
        userId: user.id,
        identifier: user.email,
        ttlMs: 48 * 60 * 60 * 1000,
      })
      devVerifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`
      await sendEmail(
        user.email,
        'Verify your DorlaCode email address',
        `Hi ${user.name},\n\nConfirm your email address by opening this link within 48 hours:\n${devVerifyUrl}\n\nIf you didn't create this account, you can ignore this email.`
      )
    }

    return jsonOk({
      message: 'If an unverified account exists for that email, a new verification link has been sent.',
      devVerifyUrl: user && user.status === 'ACTIVE' && !user.emailVerifiedAt && !env.isProduction
        ? devVerifyUrl
        : undefined,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
