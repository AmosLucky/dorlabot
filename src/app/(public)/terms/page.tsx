import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <div className="py-5">
      <div className="container py-lg-3" style={{ maxWidth: 800 }}>
        <h1 className="fw-bold mb-4">Terms of Service</h1>
        <p className="text-secondary">Last updated: October 2026</p>

        <h4 className="fw-semibold mt-4">1. Agreement</h4>
        <p className="text-secondary">
          By creating an account or using DorlaCode you agree to these terms. The platform is provided to businesses and
          individuals who operate Facebook Pages and want policy-compliant Messenger automation.
        </p>

        <h4 className="fw-semibold mt-4">2. Your responsibilities</h4>
        <ul className="text-secondary">
          <li>You must own or be authorized to manage every Page you connect.</li>
          <li>You must comply with the Meta Platform Terms, the Messenger Platform policies, and applicable laws, including anti-spam and data-protection rules.</li>
          <li>You are the controller of your contacts&apos; data; you must have a lawful basis for messaging them and honor opt-outs.</li>
          <li>You must not use the platform for unsolicited bulk messaging, harassment, misleading content, or to circumvent Meta&apos;s messaging windows or eligibility rules.</li>
        </ul>

        <h4 className="fw-semibold mt-4">3. The service</h4>
        <p className="text-secondary">
          DorlaCode automates eligible Messenger interactions using Meta&apos;s official APIs. Message delivery depends on
          Meta: we cannot guarantee that Meta will accept a send, that a message will be delivered or read, or that
          permissions granted during App Review will remain unchanged. Analytics reflect events Meta actually reports.
        </p>

        <h4 className="fw-semibold mt-4">4. Acceptable messaging</h4>
        <p className="text-secondary">
          The platform enforces safeguards — one private reply per comment within the policy window, 24-hour messaging
          windows for standard sends, opt-out suppression, and rate limits. Attempting to defeat these safeguards (including
          by misusing multiple accounts) is a material breach and may result in suspension.
        </p>

        <h4 className="fw-semibold mt-4">5. Accounts and plans</h4>
        <p className="text-secondary">
          You are responsible for your credentials and for activity under your account. Plan limits (Pages, contacts,
          automations) apply per subscription; we may adjust plan definitions with notice. Accounts in breach may be
          suspended or deleted per our retention policy.
        </p>

        <h4 className="fw-semibold mt-4">6. Data</h4>
        <p className="text-secondary">
          You grant us the limited right to process data as needed to provide the service, as described in the Privacy
          Policy. You may export contacts and delete your account at any time.
        </p>

        <h4 className="fw-semibold mt-4">7. Disclaimer and liability</h4>
        <p className="text-secondary">
          The service is provided &quot;as is&quot; without warranties to the extent permitted by law. We are not liable for
          indirect or consequential damages, for losses caused by Meta platform changes, or for lost profits arising from
          messaging ineligibility. Our aggregate liability is limited to the fees you paid in the preceding 12 months.
        </p>

        <h4 className="fw-semibold mt-4">8. Termination</h4>
        <p className="text-secondary">
          You may cancel at any time. We may suspend or terminate accounts that violate these terms, abuse the platform,
          or create legal risk for us or Meta.
        </p>

        <h4 className="fw-semibold mt-4">9. Changes</h4>
        <p className="text-secondary">We may update these terms; material changes will be communicated to registered customers in advance.</p>

        <h4 className="fw-semibold mt-4">10. Contact</h4>
        <p className="text-secondary">Questions about these terms: support@dorlacode.com.</p>
      </div>
    </div>
  )
}
