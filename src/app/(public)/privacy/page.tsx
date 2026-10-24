import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <div className="py-5">
      <div className="container py-lg-3" style={{ maxWidth: 800 }}>
        <h1 className="fw-bold mb-4">Privacy Policy</h1>
        <p className="text-secondary">Last updated: October 2026</p>

        <h4 className="fw-semibold mt-4">1. Who we are</h4>
        <p className="text-secondary">
          DorlaCode (&quot;we&quot;, &quot;the platform&quot;, available at dorlacode.com) provides multi-tenant automation for Facebook
          Page Messenger conversations, including comment-to-private-reply automations, welcome messages, default replies,
          and broadcast campaigns. This policy explains what data we process, why, and the rights you have.
        </p>

        <h4 className="fw-semibold mt-4">2. Data we process</h4>
        <ul className="text-secondary">
          <li><strong>Account data:</strong> your name, email address, hashed password, and security settings (including optional two-factor authentication).</li>
          <li><strong>Page connection data:</strong> Facebook Page IDs, Page names, connection status, granted permission scopes, and Page access tokens — stored encrypted with AES-256-GCM and never displayed to anyone, including administrators.</li>
          <li><strong>Contact data (provided by Facebook):</strong> Page-scoped IDs (PSIDs), names and profile information that Meta returns for people who interact with your Pages, interaction timestamps, and messaging-eligibility state.</li>
          <li><strong>Messaging data:</strong> the content of messages sent or received through the platform, automation outcomes, campaign recipients, and tracked-link clicks.</li>
          <li><strong>Operational data:</strong> webhook event payloads, background job results, audit logs of security-relevant actions, and usage records.</li>
        </ul>

        <h4 className="fw-semibold mt-4">3. What we deliberately do not collect</h4>
        <p className="text-secondary">
          We do not ask commenters for their email addresses, we do not attempt to unmask Facebook profiles, and we never
          use identifiers beyond the Page-scoped IDs and profile fields that Meta permits. We do not bulk-comment, scrape
          comment sections, or provide any policy-bypass features.
        </p>

        <h4 className="fw-semibold mt-4">4. How data is used</h4>
        <ul className="text-secondary">
          <li>To operate the automations you configure (comment replies, welcome and default replies, campaigns).</li>
          <li>To show you analytics and message-activity history for your own Pages.</li>
          <li>To secure the platform: webhook signature verification, rate limiting, abuse prevention, and audit trails.</li>
          <li>To send transactional emails you request (email verification, password reset, optional notifications).</li>
        </ul>

        <h4 className="fw-semibold mt-4">5. Legal bases</h4>
        <p className="text-secondary">
          Where GDPR applies, we process account data to perform our contract with you; operational and security data under
          legitimate interest; and contact data as data processor acting on your instructions as the Page owner and data
          controller for your audience.
        </p>

        <h4 className="fw-semibold mt-4">6. Sharing and processors</h4>
        <p className="text-secondary">
          We share data only with infrastructure providers required to run the service (hosting, PostgreSQL and Redis
          databases, SMTP provider for transactional email) and with Meta as required by the Messenger Platform. We never
          sell data.
        </p>

        <h4 className="fw-semibold mt-4">7. Retention and deletion</h4>
        <p className="text-secondary">
          When you disconnect a Page, its encrypted token is destroyed immediately. Message and contact history is retained
          while your account is active. If you delete your account, customer data is removed per our retention policy
          (operational logs may be retained in anonymized form for security and legal purposes).
        </p>

        <h4 className="fw-semibold mt-4">8. Your rights</h4>
        <p className="text-secondary">
          You can access, export, and correct your account data in the dashboard, and request deletion of your account at
          any time. Contacts whose data you hold can exercise their rights against you as the controller; we support you
          with export and suppression tools.
        </p>

        <h4 className="fw-semibold mt-4">9. Data deletion instructions (Meta requirement)</h4>
        <p className="text-secondary">
          Users of our Facebook integration can delete their data by disconnecting the Page in the dashboard, or by
          deleting their account under Settings → Security. Requests can also be sent to support@dorlacode.com.
        </p>

        <h4 className="fw-semibold mt-4">10. Security</h4>
        <p className="text-secondary">
          Tokens are encrypted at rest, sessions use HTTP-only cookies, all authorization is enforced server-side, and
          sensitive actions are audit-logged. No platform is perfectly secure; if you discover a vulnerability, please
          report it to support@dorlacode.com.
        </p>

        <h4 className="fw-semibold mt-4">11. Changes</h4>
        <p className="text-secondary">We will notify registered customers of material changes to this policy by email or a dashboard notice.</p>
      </div>
    </div>
  )
}
