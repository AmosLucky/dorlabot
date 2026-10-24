import { env } from '@/lib/env'

/** Shown wherever Meta-dependent features need configuration guidance. */
export default function MetaSetupNotice({ compact = false }: { compact?: boolean }) {
  if (env.meta.configured) return null
  return (
    <div className={`setup-required-banner rounded-3 p-3 mb-4 ${compact ? 'small' : ''}`}>
      <div className="d-flex gap-3">
        <i className="bi bi-plug fs-4 text-warning" aria-hidden="true" />
        <div>
          <strong>Meta integration not configured yet.</strong>
          <p className="mb-1 mt-1">
            {env.meta.appId
              ? 'The Meta App ID is set, but the App Secret is missing. Webhook verification and token exchange require both.'
              : 'Facebook connection, webhooks, and message sending require Meta app credentials. The platform will not simulate connections or sends until they are configured.'}
          </p>
          <p className="mb-0 text-secondary">
            Set <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, <code>META_WEBHOOK_VERIFY_TOKEN</code> and
            <code> META_REDIRECT_URI</code> in the server environment, then reconnect Pages. See the deployment checklist in{' '}
            <code>README.md</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
