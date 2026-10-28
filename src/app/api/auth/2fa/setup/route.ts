import { jsonOk, handleApiError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { encryptSecret, randomToken } from '@/lib/crypto'
import { env } from '@/lib/env'

/** Start 2FA enrollment: generate a TOTP secret and return the otpauth URI + QR code. */
export async function POST() {
  try {
    const user = await requireUser()
    const { authenticator } = await import('@otplib/v12-adapter')
    const secret = authenticator.generateSecret()
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorSecretEnc: encryptSecret(secret), twoFactorPending: true },
    })
    const otpauth = authenticator.keyuri(user.email, 'DorlaCode', secret)
    const QRCode = (await import('qrcode')).default
    const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 })
    // A backup handle for support: not the secret itself.
    return jsonOk({ otpauth, qrDataUrl, appName: 'DorlaCode', authUrlBase: env.appUrl, nonce: randomToken(8) })
  } catch (err) {
    return handleApiError(err)
  }
}
