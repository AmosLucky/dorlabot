import { destroyCurrentSession, getSessionUser } from '@/lib/auth'
import { jsonOk, handleApiError } from '@/lib/api'
import { audit } from '@/lib/audit'

export async function POST() {
  try {
    const user = await getSessionUser()
    await destroyCurrentSession()
    if (user) await audit({ actor: user, action: 'auth.logout' })
    return jsonOk({ signedOut: true })
  } catch (err) {
    return handleApiError(err)
  }
}
