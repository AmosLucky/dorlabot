import { z } from 'zod'
import { jsonOk, jsonError, handleApiError, parseBody } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { audit } from '@/lib/audit'

const schema = z.object({ password: z.string().min(1) })

/** Disable 2FA — requires the account password. */
export async function POST(req: Request) {
  try {
    const sessionUser = await requireUser()
    const { password } = await parseBody(req, schema)
    const user = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id } })
    if (!verifyPassword(password, user.passwordHash)) {
      return jsonError('Incorrect password.', 401, 'INVALID_PASSWORD')
    }
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorPending: false, twoFactorSecretEnc: null },
    })
    await audit({ actor: sessionUser, action: 'auth.2fa_disabled' })
    return jsonOk({ disabled: true })
  } catch (err) {
    return handleApiError(err)
  }
}
