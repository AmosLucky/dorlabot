import { db } from '@/lib/db'

/**
 * Platform-level settings with safe defaults.
 * These back the configurable, testable business rules required by Meta policy:
 * private-reply window, messaging window, campaign throughput, etc.
 * Values are editable by super admins at /admin/settings.
 */

export const SETTING_DEFAULTS = {
  privateReplyWindowDays: 7, // Meta: one private reply per comment, within policy window
  messagingWindowHours: 24, // Meta: standard messaging window after last user interaction
  campaignRatePerMinute: 60, // outgoing campaign sends per minute (per queue worker)
  maxPrivateRepliesPerComment: 1,
  requireWindowForCampaigns: true,
  registrationEnabled: true,
  supportEmail: 'support@dorlacode.com',
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS
export type PlatformSettings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] }

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await db.platformSetting.findMany({ where: { key: { in: Object.keys(SETTING_DEFAULTS) } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const out = { ...SETTING_DEFAULTS } as Record<string, unknown>
  for (const key of Object.keys(SETTING_DEFAULTS)) {
    const v = map.get(key)
    if (v !== undefined && v !== null && typeof v === (typeof SETTING_DEFAULTS[key as SettingKey])) {
      out[key] = v
    }
  }
  return out as PlatformSettings
}

export async function setPlatformSetting(key: SettingKey, value: string | number | boolean): Promise<void> {
  await db.platformSetting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  })
}
