import { z } from 'zod'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { authenticator } from '@otplib/v12-adapter'
import { decryptSecret } from '@/lib/crypto'
import { audit } from '@/lib/audit'

const schema = z.object({ code: z.string().min(6).max(10) })

/** Confirm 2FA enrollment with the first valid TOTP code. */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { code } = await parseBody(req, schema)
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    if (!fresh.twoFactorSecretEnc || !fresh.twoFactorPending) {
      return jsonError('Start two-factor setup first.', 400, 'NO_PENDING_SETUP')
    }
    const secret = decryptSecret(fresh.twoFactorSecretEnc)
    if (!authenticator.check(code.replace(/\s/g, ''), secret)) {
      return jsonError('That code is not valid. Check your authenticator app and try again.', 401, 'INVALID_CODE')
    }
    await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorPending: false } })
    await audit({ actor: user, action: 'auth.2fa_enabled' })
    return jsonOk({ enabled: true })
  } catch (err) {
    return handleApiError(err)
  }
}
