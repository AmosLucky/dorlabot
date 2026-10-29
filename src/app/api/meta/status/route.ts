import { env } from '@/lib/env'
import { jsonOk } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  return jsonOk({
    configured: env.meta.configured,
    appIdConfigured: Boolean(env.meta.appId),
  })
}
