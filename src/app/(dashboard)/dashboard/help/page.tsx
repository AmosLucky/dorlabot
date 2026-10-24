import Link from 'next/link'
import { env } from '@/lib/env'
import { getPlatformSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

export default async function HelpPage() {
  const settings = await getPlatformSettings().catch(() => null)
  return (
    <div style={{ maxWidth: 860 }}>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">Help &amp; Support</h1>
        <p className="text-secondary small mb-0">Guides for connecting Pages, Meta App Review, and troubleshooting.</p>
      </div>

      <div className="accordion d-grid gap-3" id="helpAccordion">
        <div className="card">
          <div className="card-header" id="h1">
            <button className="btn btn-link text-decoration-none p-0 fw-semibold" data-bs-toggle="collapse" data-bs-target="#c1" aria-expanded="true">
              1. Connecting a Facebook Page
            </button>
          </div>
          <div id="c1" className="collapse show" data-bs-parent="#helpAccordion">
            <div className="card-body small text-secondary">
              <ol className="mb-0 ps-3">
                <li>Go to <Link href="/dashboard/pages">Facebook Pages</Link> and click <strong>Connect Facebook Page</strong>.</li>
                <li>Sign in with Facebook and grant the requested permissions (Pages you manage, messaging, webhook management).</li>
                <li>Select the Pages you want DorlaCode to configure.</li>
                <li>Done — the Page subscribes to Messenger and feed webhooks automatically.</li>
              </ol>
              {!env.meta.configured && (
                <div className="alert alert-warning mt-3 mb-0 py-2">
                  Meta credentials are not configured on this deployment yet, so the Facebook connection flow cannot run. The
                  operator needs to set <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, and <code>META_WEBHOOK_VERIFY_TOKEN</code>.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" id="h2">
            <button className="btn btn-link text-decoration-none p-0 fw-semibold collapsed" data-bs-toggle="collapse" data-bs-target="#c2">
              2. How messaging eligibility works
            </button>
          </div>
          <div id="c2" className="collapse" data-bs-parent="#helpAccordion">
            <div className="card-body small text-secondary">
              <ul className="mb-0 ps-3">
                <li><strong>Comment private replies:</strong> one reply per comment, within the {settings?.privateReplyWindowDays ?? 7}-day policy window (configurable by admins).</li>
                <li><strong>Standard messages:</strong> allowed for 24 hours after a person&apos;s last message to your Page.</li>
                <li><strong>Campaigns:</strong> only contacts with an open window receive sends; opt-outs are always excluded.</li>
                <li>Commenting alone never opens a messaging window — it only permits the single private reply.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" id="h3">
            <button className="btn btn-link text-decoration-none p-0 fw-semibold collapsed" data-bs-toggle="collapse" data-bs-target="#c3">
              3. Troubleshooting: Page shows TOKEN_EXPIRED or ERROR
            </button>
          </div>
          <div id="c3" className="collapse" data-bs-parent="#helpAccordion">
            <div className="card-body small text-secondary">
              Tokens can expire or be revoked when you change your Facebook password or remove the app. Click <strong>Sync</strong> to
              test the token; if it fails, click <strong>Connect Facebook Page</strong> again to re-authorize. Automations pause safely
              until the Page is connected.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" id="h4">
            <button className="btn btn-link text-decoration-none p-0 fw-semibold collapsed" data-bs-toggle="collapse" data-bs-target="#c4">
              4. Why was an event skipped?
            </button>
          </div>
          <div id="c4" className="collapse" data-bs-parent="#helpAccordion">
            <div className="card-body small text-secondary">
              <p className="mb-2">Open <Link href="/dashboard/activity">Message Activity</Link> and check the SKIPPED rows. Common reasons:</p>
              <ul className="mb-0 ps-3">
                <li><code>keyword_not_matched</code> — the comment didn&apos;t contain any of your keywords.</li>
                <li><code>already_replied</code> — this comment already received its one permitted private reply.</li>
                <li><code>outside_private_reply_window</code> — the comment is older than the policy window.</li>
                <li><code>comment_by_page</code> — the Page&apos;s own comments never trigger replies.</li>
                <li><code>messaging_window_closed</code> — campaigns only message contacts with an open window.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" id="h5">
            <button className="btn btn-link text-decoration-none p-0 fw-semibold collapsed" data-bs-toggle="collapse" data-bs-target="#c5">
              5. Contacting support
            </button>
          </div>
          <div id="c5" className="collapse" data-bs-parent="#helpAccordion">
            <div className="card-body small text-secondary">
              Email <strong>{settings?.supportEmail ?? 'support@dorlacode.com'}</strong> with your account email, the affected Page, and
              the time of the problem. Include a screenshot of the activity row if possible.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
