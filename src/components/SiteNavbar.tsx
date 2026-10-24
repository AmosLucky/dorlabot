import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'

export default async function SiteNavbar() {
  const user = await getSessionUser()
  const dashboardHref = user ? (user.role === 'ADMIN' ? '/admin' : '/dashboard') : '/login'
  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
      <div className="container">
        <Link className="navbar-brand fw-bold d-flex align-items-center gap-2" href="/">
          <span className="feature-icon" style={{ width: 34, height: 34, fontSize: '1rem', borderRadius: 10 }}>
            <i className="bi bi-messenger" />
          </span>
          Dorla<span className="text-primary">Code</span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#siteNav"
          aria-controls="siteNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="siteNav">
          <ul className="navbar-nav mx-auto gap-lg-2">
            <li className="nav-item">
              <Link className="nav-link nav-marketing-link" href="/features">Features</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link nav-marketing-link" href="/pricing">Pricing</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link nav-marketing-link" href="/faq">FAQ</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link nav-marketing-link" href="/contact">Contact</Link>
            </li>
          </ul>
          <div className="d-flex gap-2 align-items-center">
            {user ? (
              <Link href={dashboardHref} className="btn btn-primary">
                {user.role === 'ADMIN' ? 'Admin panel' : 'Open dashboard'}
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-light">Log in</Link>
                <Link href="/register" className="btn btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
