import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, passwordStrengthError } from '@/lib/password'
import { jsonOk, handleApiError, parseBody, enforceRateLimitAsync } from '@/lib/api'
import { RateLimits } from '@/lib/rate-limit'
import { issueToken } from '@/features/auth/tokens'
import { sendEmail, devEmailLinkEnabled } from '@/lib/email'
import { env } from '@/lib/env'
import { getPlatformSettings } from '@/lib/settings'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/auth'

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  password: z.string(),
})

export async function POST(req: Request) {
  try {
    await enforceRateLimitAsync('register', RateLimits.register)
    const body = await parseBody(req, schema)
    const strengthError = passwordStrengthError(body.password)
    if (strengthError) return jsonError(strengthError, 422, 'WEAK_PASSWORD')

    const settings = await getPlatformSettings()
    if (!settings.registrationEnabled) {
      return jsonError('Registration is temporarily disabled by the platform administrator.', 403, 'REGISTRATION_DISABLED')
    }

    const existing = await db.user.findUnique({ where: { email: body.email } })
    if (existing) {
      return jsonError('An account with this email already exists. Try signing in or resetting your password.', 409, 'EMAIL_TAKEN')
    }

    const bootstrapAdmin = env.adminBootstrapEmails.includes(body.email)
    const user = await db.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: hashPassword(body.password),
        role: bootstrapAdmin ? 'ADMIN' : 'CUSTOMER',
      },
    })

    // Default plan subscription (Starter or first active plan).
    const defaultPlan =
      (await db.subscriptionPlan.findUnique({ where: { key: 'starter' } })) ??
      (await db.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }))
    if (defaultPlan) {
      await db.customerSubscription.create({ data: { userId: user.id, planId: defaultPlan.id } })
    }

    const verifyToken = await issueToken({ type: 'EMAIL_VERIFY', userId: user.id, identifier: user.email, ttlMs: 48 * 3600 * 1000 })
    const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`
    await sendEmail(
      user.email,
      'Verify your DorlaCode email address',
      `Welcome to DorlaCode, ${user.name}!\n\nConfirm your email address by opening this link within 48 hours:\n${verifyUrl}\n\nIf you didn't create this account, you can ignore this email.`
    )

    await audit({ actorUserId: user.id, actorEmail: user.email, actorRole: user.role, action: 'auth.register' })

    return jsonOk({
      userId: user.id,
      message: 'Account created. Check your email to verify your address before signing in.',
      // Dev convenience only (non-production without SMTP): the link is returned so flows can be tested.
      devVerifyUrl: devEmailLinkEnabled() ? verifyUrl : undefined,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function GET() {
  // Used by the register page to check whether registration is open.
  const settings = await getPlatformSettings()
  const ip = await getClientIp()
  return jsonOk({ registrationEnabled: settings.registrationEnabled })
}
