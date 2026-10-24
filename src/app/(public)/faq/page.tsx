import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FAQ' }

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How does comment-to-private-reply work?',
    a: 'When someone comments on an eligible post of your connected Page, Meta sends us a webhook event. We verify its signature, persist it, and check your automation rules: targeting, keywords, duplicates, and Meta’s private-reply policy window. If everything is eligible, we send one private reply through the official Messenger Platform and log the outcome.',
  },
  {
    q: 'Does a comment mean the person opted into marketing?',
    a: 'No. A comment only makes the commenter eligible for a single private reply to that specific comment within Meta’s policy window (we default to 7 days and make it configurable). Regular messages to that person require them to message your Page first, which opens the standard 24-hour messaging window.',
  },
  {
    q: 'How many private replies can be sent per comment?',
    a: 'Exactly one. Our database enforces a unique constraint per comment, so duplicate webhook deliveries or replays can never trigger a second reply.',
  },
  {
    q: 'What are the requirements to connect a Facebook Page?',
    a: 'You need to be an admin (or have the allowed tasks) on the Page, and you grant the requested permissions through Facebook Login. Pages are connected via Meta’s official OAuth flow; the Page access token is exchanged server-side and stored encrypted. If the Meta app is still awaiting App Review, some permissions may be unavailable — the platform will show exactly what is missing.',
  },
  {
    q: 'Can I send broadcast campaigns to everyone who ever commented?',
    a: 'No — and no legitimate platform should claim otherwise. Campaigns can only target contacts with an open messaging window (they messaged your Page within the last 24 hours by default). Contacts who opted out are always excluded, and you see the eligible audience estimate before launching.',
  },
  {
    q: 'How is CTR calculated?',
    a: 'Click-through rate = unique tracked clickers ÷ delivered messages × 100. If delivery events are not available from Meta, we clearly label the alternative denominator (e.g. sent messages) instead of presenting a misleading percentage.',
  },
  {
    q: 'What happens when my Page token expires or is revoked?',
    a: 'The Page shows a TOKEN_EXPIRED or ERROR status with reconnection instructions. Automations pause their sends safely and events are marked accordingly — nothing is attempted with invalid credentials.',
  },
  {
    q: 'Do you store my Facebook password?',
    a: 'Never. Authentication happens entirely on Facebook via the official OAuth flow. We receive and store only the tokens Meta returns, encrypted with AES-256-GCM, and they are never exposed in the dashboard, API responses, or logs.',
  },
  {
    q: 'Is my customer data isolated from other accounts?',
    a: 'Yes. Every query enforces tenant ownership on the server — one customer can never read or modify another customer’s Pages, contacts, campaigns, or analytics. Administrative access is role-checked server-side and recorded in audit logs.',
  },
  {
    q: 'Can I export or delete my data?',
    a: 'Yes. Contacts support CSV export, and account deletion removes your data according to our retention policy. See the Privacy Policy for details, and contact support if you need a one-off export.',
  },
]

export default function FaqPage() {
  return (
    <div className="py-5">
      <div className="container py-lg-4" style={{ maxWidth: 780 }}>
        <div className="text-center mb-5">
          <h1 className="fw-bold display-6">Frequently asked questions</h1>
          <p className="lead text-secondary">Straight answers about how the platform works and how it respects Meta’s rules.</p>
        </div>
        <div className="d-grid gap-3">
          {FAQS.map((f) => (
            <details className="card faq-item" key={f.q}>
              <summary className="card-body py-3">{f.q}</summary>
              <div className="card-body pt-0 text-secondary">{f.a}</div>
            </details>
          ))}
        </div>
        <div className="soft-panel p-4 mt-4 text-center">
          <p className="mb-2 fw-semibold">Still have questions?</p>
          <Link href="/contact" className="btn btn-primary">Contact support</Link>
        </div>
      </div>
    </div>
  )
}
