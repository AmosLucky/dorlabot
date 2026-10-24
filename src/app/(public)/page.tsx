import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DorlaCode — Turn Facebook comments into Messenger conversations',
}

const FEATURES = [
  {
    icon: 'bi-chat-heart',
    title: 'Comment-to-DM automation',
    text: 'When someone comments on your eligible posts, DorlaCode sends a private reply through the official Messenger Platform — once per comment, inside the policy window.',
  },
  {
    icon: 'bi-hand-thumbs-up',
    title: 'Welcome messages',
    text: 'Greet first-time Messenger contacts with a personalized welcome and optional quick replies, so every conversation starts on the right foot.',
  },
  {
    icon: 'bi-send',
    title: 'Compliant broadcasts',
    text: 'Send campaigns only to contacts with an open messaging window. Audience estimates, throttled queue delivery, and opt-out handling are built in.',
  },
  {
    icon: 'bi-graph-up-arrow',
    title: 'Analytics & click tracking',
    text: 'Track sends, deliveries, reads, failures, and unique link clicks with honest, clearly-defined CTR math and Chart.js dashboards.',
  },
]

const FAQS = [
  {
    q: 'Does a comment opt someone into marketing?',
    a: 'No. A comment makes the person eligible for a single private reply to that comment within Meta’s policy window. Regular promotional messages require an open messaging window — the person must have messaged your Page.',
  },
  {
    q: 'Do I need my own Facebook app?',
    a: 'Your Pages are connected through our Meta app using the official Facebook Login flow, or you can configure your own Meta app credentials for white-label use. Either way, tokens stay encrypted on our servers.',
  },
  {
    q: 'What happens if messaging is not permitted?',
    a: 'Every event shows a clear status — processed, skipped, failed, or policy-ineligible — with the reason. We never attempt sends that Meta’s rules do not allow.',
  },
]

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="hero py-5">
        <div className="container py-lg-5">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <span className="badge badge-soft-primary mb-3 px-3 py-2">
                <i className="bi bi-shield-check me-1" /> Official Meta Graph API · Policy-aware by design
              </span>
              <h1 className="display-5 fw-bold mb-3">
                Turn Facebook comments into <span className="hero-gradient-text">Messenger conversations</span>
              </h1>
              <p className="lead text-secondary mb-4">
                DorlaCode watches your Page&apos;s comment section, replies privately to eligible commenters, welcomes new
                Messenger contacts, and delivers broadcast campaigns that respect every Meta messaging rule — with
                analytics that tell the truth.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <Link href="/register" className="btn btn-primary btn-lg px-4">
                  Get started free <i className="bi bi-arrow-right ms-1" />
                </Link>
                <Link href="/pricing" className="btn btn-light btn-lg px-4 border">
                  See pricing
                </Link>
              </div>
              <p className="small text-secondary mt-3 mb-0">
                Connect your first Page in minutes · No credit card required · Cancel anytime
              </p>
            </div>
            <div className="col-lg-5 offset-lg-1">
              <div className="phone-mock mx-auto">
                <div className="p-3 border-bottom d-flex align-items-center gap-2">
                  <span className="avatar-initials" style={{ background: '#e0e7ff', color: '#4338ca' }}>YP</span>
                  <div>
                    <div className="fw-semibold small">Your Page</div>
                    <div className="text-secondary" style={{ fontSize: '0.72rem' }}>Typically replies instantly</div>
                  </div>
                </div>
                <div className="p-3 d-grid gap-2" style={{ minHeight: 280 }}>
                  <div className="chat-bubble chat-bubble-in">
                    <div className="fw-semibold small mb-1">Sara M. commented</div>
                    “Hi! Can I get the full price list please? 🙌”
                  </div>
                  <div className="text-secondary text-center" style={{ fontSize: '0.68rem' }}>
                    <i className="bi bi-lightning-charge-fill text-warning me-1" />
                    Automation triggered · eligible comment
                  </div>
                  <div className="chat-bubble chat-bubble-out">
                    Hi Sara! 👋 Thanks for your comment. Here&apos;s the information you requested: bit.ly/prices
                  </div>
                  <div className="text-secondary text-end" style={{ fontSize: '0.68rem' }}>
                    Private reply · sent via Messenger Platform
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-5">
        <div className="container py-lg-4">
          <div className="text-center mb-5">
            <h2 className="fw-bold">From comment to conversation in four steps</h2>
            <p className="text-secondary mx-auto" style={{ maxWidth: 560 }}>
              A workflow your customers experience in seconds — built entirely on Meta&apos;s official Messenger Platform.
            </p>
          </div>
          <div className="row g-4">
            {[
              { n: '1', icon: 'bi-chat-dots', t: 'A person comments', d: 'Someone asks for info on one of your eligible Page posts.' },
              { n: '2', icon: 'bi-broadcast-pin', t: 'Meta notifies us', d: 'A signed webhook event reaches our servers and is verified, persisted, and queued.' },
              { n: '3', icon: 'bi-shield-check', t: 'Eligibility is checked', d: 'Keyword rules, post targeting, duplicate protection, and Meta messaging policy are evaluated.' },
              { n: '4', icon: 'bi-send-check', t: 'Private reply is sent', d: 'The permitted private reply goes out through the official API and is logged with its outcome.' },
            ].map((s) => (
              <div className="col-md-6 col-lg-3" key={s.n}>
                <div className="card h-100 hover-lift">
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="feature-icon"><i className={`bi ${s.icon}`} /></span>
                      <span className="fw-bold text-primary fs-4">{s.n}</span>
                    </div>
                    <h5 className="fw-semibold">{s.t}</h5>
                    <p className="text-secondary small mb-0">{s.d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-5 soft-panel">
        <div className="container py-lg-4">
          <div className="text-center mb-5">
            <h2 className="fw-bold">Everything you need to automate Messenger</h2>
            <p className="text-secondary mx-auto" style={{ maxWidth: 520 }}>Four pillars, one dashboard, zero policy shortcuts.</p>
          </div>
          <div className="row g-4">
            {FEATURES.map((f) => (
              <div className="col-md-6 col-lg-3" key={f.title}>
                <div className="card h-100 hover-lift">
                  <div className="card-body">
                    <span className="feature-icon mb-3"><i className={`bi ${f.icon}`} /></span>
                    <h5 className="fw-semibold">{f.title}</h5>
                    <p className="text-secondary small mb-0">{f.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="py-5">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="text-center mb-4">
            <h2 className="fw-bold">Frequently asked questions</h2>
          </div>
          <div className="d-grid gap-3">
            {FAQS.map((f) => (
              <div className="card" key={f.q}>
                <div className="card-body">
                  <div className="fw-semibold mb-1">{f.q}</div>
                  <p className="text-secondary small mb-0">{f.a}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link href="/faq" className="btn btn-outline-primary">
              View all FAQs <i className="bi bi-arrow-right ms-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-5" style={{ background: 'var(--fc-sidebar)' }}>
        <div className="container py-lg-4 text-center text-white">
          <h2 className="fw-bold mb-3">Ready to automate your Page&apos;s conversations?</h2>
          <p className="mb-4" style={{ color: '#cfc9e6' }}>
            Connect a Facebook Page, create your first automation, and let eligible conversations happen automatically.
          </p>
          <Link href="/register" className="btn btn-primary btn-lg px-5">
            Create your account <i className="bi bi-arrow-right ms-1" />
          </Link>
        </div>
      </section>
    </>
  )
}
