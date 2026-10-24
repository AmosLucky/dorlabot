import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'var(--fc-bg-soft)' }}>
      <div className="container py-4">
        <Link href="/" className="navbar-brand fw-bold d-inline-flex align-items-center gap-2">
          <span className="feature-icon" style={{ width: 34, height: 34, fontSize: '1rem', borderRadius: 10 }}>
            <i className="bi bi-messenger" />
          </span>
          Dorla<span className="text-primary">Code</span>
        </Link>
      </div>
      <main className="flex-grow-1 d-flex align-items-start align-items-lg-center py-4">
        <div className="container" style={{ maxWidth: 460 }}>
          {children}
        </div>
      </main>
      <footer className="py-3 text-center small text-secondary">
        © {new Date().getFullYear()} DorlaCode · <Link href="/privacy" className="text-secondary">Privacy</Link> ·{' '}
        <Link href="/terms" className="text-secondary">Terms</Link> · <Link href="/cookies" className="text-secondary">Cookies</Link>
      </footer>
    </div>
  )
}
