import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Features' }

const SECTIONS = [
  {
    icon: 'bi-chat-left-heart',
    title: 'Comment-to-private-reply automation',
    points: [
      'Trigger on any comment or only on matching keywords (contains, exact, starts-with).',
      'Target all eligible posts or a selected allow-list of posts.',
      'Personalize replies with {{first_name}} and other supported variables, with safe fallbacks.',
      'Duplicate protection: exactly one private reply per comment, enforced at the database level.',
      'Full visibility: processed, skipped, failed, and policy-ineligible events with reasons.',
    ],
  },
  {
    icon: 'bi-door-open',
    title: 'Welcome messages & default replies',
    points: [
      'Greet first-time Messenger contacts once, only when they message your Page.',
      'Keyword-based default replies with a configurable fallback message.',
      'Optional quick replies on welcome flows where Meta supports them.',
      'Reply-loop protection: echoes and Page-originated events are ignored automatically.',
      'Preview and test formatting before enabling any automation.',
    ],
  },
  {
    icon: 'bi-people',
    title: 'Contacts & audience management',
    points: [
      'One contact record per person per Page, built from real Messenger interactions.',
      'Messaging eligibility is tracked — never assume a commenter is a subscriber.',
      'Tags, notes, search, filters, segments, CSV export, and opt-out suppression.',
      'We only use Page-scoped IDs and profile fields that Meta permits.',
    ],
  },
  {
    icon: 'bi-megaphone',
    title: 'Policy-aware broadcast campaigns',
    points: [
      'Audience estimates before launch — see exactly how many recipients are eligible.',
      'Eligibility re-checked per recipient at send time (opt-outs and closed windows excluded).',
      'Durable Redis/BullMQ delivery with throttling, retries, and permanent-failure handling.',
      'Pause or cancel pending campaigns; status reflects actual processing results.',
      'Tracked links with unique click attribution and deduplicated click counts.',
    ],
  },
  {
    icon: 'bi-graph-up',
    title: 'Analytics you can trust',
    points: [
      'Sends, deliveries, and reads recorded only when Meta reports them.',
      'CTR with clearly labeled denominators — no invented delivery numbers.',
      'Automation performance over time and campaign comparison charts.',
      'Date filters: last 7 / 30 / 90 days plus custom ranges.',
    ],
  },
  {
    icon: 'bi-shield-lock',
    title: 'Security & compliance foundation',
    points: [
      'AES-256-GCM encrypted Page tokens; secrets never reach the browser or logs.',
      'Signed webhook verification (X-Hub-Signature-256) and idempotent event processing.',
      'Tenant isolation enforced on the server for every record.',
      'Audit logs, rate limiting, optional two-factor authentication, and session management.',
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className="py-5">
      <div className="container py-lg-4" style={{ maxWidth: 980 }}>
        <div className="text-center mb-5">
          <h1 className="fw-bold display-6">Built for real Messenger marketing</h1>
          <p className="lead text-secondary mx-auto" style={{ maxWidth: 640 }}>
            Every feature is designed around what Meta&apos;s policies actually permit — so your Page stays safe while
            conversations scale.
          </p>
        </div>
        <div className="row g-4">
          {SECTIONS.map((s) => (
            <div className="col-md-6" key={s.title}>
              <div className="card h-100">
                <div className="card-body p-4">
                  <span className="feature-icon mb-3"><i className={`bi ${s.icon}`} /></span>
                  <h4 className="fw-semibold">{s.title}</h4>
                  <ul className="text-secondary small d-grid gap-2 ps-3 mb-0">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-5">
          <Link href="/register" className="btn btn-primary btn-lg px-4">Start automating <i className="bi bi-arrow-right ms-1" /></Link>
        </div>
      </div>
    </div>
  )
}
