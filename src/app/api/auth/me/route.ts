import { jsonOk, handleApiError } from '@/lib/api'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    return jsonOk({ user })
  } catch (err) {
    return handleApiError(err)
  }
}
