import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { jsonOk, handleApiError, parseBody } from '@/lib/api'
import { setPlatformSetting, getPlatformSettings, type SettingKey } from '@/lib/settings'
import { audit } from '@/lib/audit'

export async function GET() {
  try {
    await requireAdmin()
    const settings = await getPlatformSettings()
    return jsonOk({ settings })
  } catch (err) {
    return handleApiError(err)
  }
}

const schema = z.object({
  settings: z.array(z.object({ key: z.string().min(1).max(60), value: z.union([z.string(), z.number(), z.boolean()]) })).max(20),
})

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin()
    const body = await parseBody(req, schema)
    const validKeys = Object.keys(await getPlatformSettings())
    for (const s of body.settings) {
      if (!validKeys.includes(s.key)) continue
      await setPlatformSetting(s.key as SettingKey, s.value)
    }
    await audit({ actor: admin, action: 'admin.settings_update', metadata: { keys: body.settings.map((s) => s.key) } })
    const settings = await getPlatformSettings()
    return jsonOk({ settings })
  } catch (err) {
    return handleApiError(err)
  }
}
