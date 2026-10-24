import { db } from '@/lib/db'
import { getClientIp, type SessionUser } from '@/lib/auth'

export type AuditAction =
  | 'auth.register'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_change'
  | 'auth.password_reset'
  | 'auth.email_verified'
  | 'auth.2fa_enabled'
  | 'auth.2fa_disabled'
  | 'page.connect'
  | 'page.disconnect'
  | 'page.sync'
  | 'automation.create'
  | 'automation.update'
  | 'automation.delete'
  | 'automation.status'
  | 'contact.update'
  | 'contact.delete'
  | 'contact.optout'
  | 'campaign.create'
  | 'campaign.update'
  | 'campaign.launch'
  | 'campaign.cancel'
  | 'campaign.delete'
  | 'admin.user_suspend'
  | 'admin.user_reactivate'
  | 'admin.user_delete'
  | 'admin.settings_update'
  | 'admin.job_retry'
  | 'admin.job_resolve'

export async function audit(params: {
  actor?: SessionUser | null
  actorUserId?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  action: AuditAction
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}) {
  try {
    let ip: string | null = null
    try {
      ip = await getClientIp()
    } catch {
      /* outside request */
    }
    await db.auditLog.create({
      data: {
        actorUserId: params.actor?.id ?? params.actorUserId ?? null,
        actorEmail: params.actor?.email ?? params.actorEmail ?? null,
        actorRole: params.actor?.role ?? params.actorRole ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: (params.metadata ?? undefined) as never,
        ip,
      },
    })
  } catch (err) {
    console.error('[audit] failed to write audit log', err)
  }
}
