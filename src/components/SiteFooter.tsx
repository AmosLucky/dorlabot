import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="border-top mt-auto py-5" style={{ background: 'var(--fc-bg-soft)' }}>
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="feature-icon" style={{ width: 34, height: 34, fontSize: '1rem', borderRadius: 10 }}>
                <i className="bi bi-messenger" />
              </span>
              <span className="fw-bold fs-5">Dorla<span className="text-primary">Code</span></span>
            </div>
            <p className="text-secondary small mb-2" style={{ maxWidth: 320 }}>
              Policy-aware Facebook Messenger automation: comment-to-DM private replies, welcome messages, and compliant broadcast campaigns.
            </p>
            <p className="small text-secondary mb-0">
              <i className="bi bi-envelope me-1" /> support@dorlacode.com
            </p>
          </div>
          <div className="col-6 col-lg-2 offset-lg-1">
            <h6 className="fw-semibold mb-3">Product</h6>
            <ul className="list-unstyled d-grid gap-2 small">
              <li><Link href="/features" className="text-secondary">Features</Link></li>
              <li><Link href="/pricing" className="text-secondary">Pricing</Link></li>
              <li><Link href="/faq" className="text-secondary">FAQ</Link></li>
              <li><Link href="/register" className="text-secondary">Get started</Link></li>
            </ul>
          </div>
          <div className="col-6 col-lg-2">
            <h6 className="fw-semibold mb-3">Company</h6>
            <ul className="list-unstyled d-grid gap-2 small">
              <li><Link href="/contact" className="text-secondary">Contact</Link></li>
              <li><Link href="/dashboard/help" className="text-secondary">Help &amp; support</Link></li>
            </ul>
          </div>
          <div className="col-6 col-lg-2">
            <h6 className="fw-semibold mb-3">Legal</h6>
            <ul className="list-unstyled d-grid gap-2 small">
              <li><Link href="/privacy" className="text-secondary">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-secondary">Terms of Service</Link></li>
              <li><Link href="/cookies" className="text-secondary">Cookie Policy</Link></li>
            </ul>
          </div>
          <div className="col-6 col-lg-2">
            <h6 className="fw-semibold mb-3">Compliance</h6>
            <p className="small text-secondary mb-0">
              Built on the official Meta Graph API. Messaging follows current Meta platform terms.
            </p>
          </div>
        </div>
        <hr className="my-4" />
        <div className="d-flex flex-column flex-md-row justify-content-between gap-2 small text-secondary">
          <span>© {new Date().getFullYear()} DorlaCode · dorlacode.com</span>
          <span>Not affiliated with Meta Platforms, Inc.</span>
        </div>
      </div>
    </footer>
  )
}
