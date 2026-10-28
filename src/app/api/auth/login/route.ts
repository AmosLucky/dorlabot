import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { jsonOk, jsonError, handleApiError, parseBody, enforceRateLimitAsync } from '@/lib/api'
import { RateLimits, rateLimit } from '@/lib/rate-limit'
import { createSession, getClientIp } from '@/lib/auth'
import { issueToken } from '@/features/auth/tokens'
import { audit } from '@/lib/audit'

const schema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(200),
  password: z.string().min(1).max(200),
  pendingTwoFactorToken: z.string().optional(),
  twoFactorCode: z.string().optional(),
})

const LOCK_THRESHOLD = 5
const LOCK_MINUTES = 15

export async function POST(req: Request) {
  try {
    await enforceRateLimitAsync('login', RateLimits.login)
    const body = await parseBody(req, schema)
    const ip = await getClientIp()

    const user = await db.user.findUnique({ where: { email: body.email } })

    if (!user) {
      rateLimit(`login-user:${body.email}`, 10, 15 * 60 * 1000)
      await audit({ actorEmail: body.email, action: 'auth.login_failed', metadata: { reason: 'unknown_user' } })
      return jsonError('Invalid email or password.', 401, 'INVALID_CREDENTIALS')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      return jsonError(`Account temporarily locked after repeated failed attempts. Try again in ${mins} minute(s).`, 423, 'LOCKED')
    }

    if (user.status === 'SUSPENDED') {
      return jsonError('This account has been suspended. Contact support for assistance.', 403, 'SUSPENDED')
    }
    if (user.status === 'DELETED') {
      return jsonError('Invalid email or password.', 401, 'INVALID_CREDENTIALS')
    }

    if (!verifyPassword(body.password, user.passwordHash)) {
      const failed = user.failedLoginCount + 1
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: failed >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
        },
      })
      await audit({ actorUserId: user.id, actorEmail: user.email, action: 'auth.login_failed', metadata: { ip } })
      return jsonError('Invalid email or password.', 401, 'INVALID_CREDENTIALS')
    }

    // ── Two-factor step ──
    if (user.twoFactorEnabled) {
      if (!body.pendingTwoFactorToken || !body.twoFactorCode) {
        const pendingToken = await issueToken({ type: 'TWOFA_PENDING', userId: user.id, ttlMs: 5 * 60 * 1000 })
        return jsonOk({ twoFactorRequired: true, pendingToken })
      }
      const { consumeToken } = await import('@/features/auth/tokens')
      const pending = await consumeToken({ type: 'TWOFA_PENDING', token: body.pendingTwoFactorToken })
      if (!pending || pending.userId !== user.id) {
        return jsonError('Two-factor session expired. Please sign in again.', 401, 'TWOFA_EXPIRED')
      }
      const { authenticator } = await import('@otplib/v12-adapter')
      const { decryptSecret } = await import('@/lib/crypto')
      const secret = user.twoFactorSecretEnc ? decryptSecret(user.twoFactorSecretEnc) : null
      if (!secret || !authenticator.check(body.twoFactorCode.replace(/\s/g, ''), secret)) {
        return jsonError('Invalid two-factor code.', 401, 'INVALID_TWOFA')
      }
    }

    if (!user.emailVerifiedAt) {
      return jsonError('Please verify your email address before signing in. Check your inbox for the verification link.', 403, 'EMAIL_UNVERIFIED')
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
    })
    await createSession(user.id)
    await audit({ actorUserId: user.id, actorEmail: user.email, actorRole: user.role, action: 'auth.login' })

    return jsonOk({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirect: user.role === 'ADMIN' ? '/admin' : '/dashboard',
    })
  } catch (err) {
    return handleApiError(err)
  }
}
