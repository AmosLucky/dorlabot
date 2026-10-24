'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

export type DashNavItem = { href: string; label: string; icon: string; exact?: boolean }

function NavLinks({ items, onNavigate }: { items: DashNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <ul className="nav flex-column gap-1 mt-3 px-2">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <li className="nav-item" key={item.href}>
            <Link href={item.href} className={`nav-link ${active ? 'active' : ''}`} onClick={onNavigate}>
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function DashboardShell({
  items,
  user,
  children,
  variant = 'customer',
}: {
  items: DashNavItem[]
  user: { name: string; email: string; role: string }
  children: ReactNode
  variant?: 'customer' | 'admin'
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="dash-shell d-flex">
      <aside className={`dash-sidebar ${sidebarOpen ? 'show' : ''}`}>
        <div className="p-3 pb-0">
          <Link href="/" className="brand d-flex align-items-center gap-2 text-decoration-none">
            <span className="feature-icon" style={{ width: 34, height: 34, fontSize: '1rem', borderRadius: 10 }}>
              <i className="bi bi-messenger" />
            </span>
            <span>Dorla{variant === 'admin' ? 'Admin' : 'Code'}</span>
          </Link>
          {variant === 'admin' && <div className="small mt-2 ps-1" style={{ color: '#8d84b8' }}>Super-admin console</div>}
        </div>
        <NavLinks items={items} onNavigate={() => setSidebarOpen(false)} />
        <div className="mt-auto p-3 small" style={{ color: '#8d84b8' }}>
          <div>dorlacode.com</div>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop show" onClick={() => setSidebarOpen(false)} role="presentation" />}

      <div className="dash-main flex-grow-1">
        <header className="dash-topbar d-flex align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-light d-lg-none" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <i className="bi bi-list fs-5" />
            </button>
            <span className="fw-semibold text-secondary small d-none d-sm-block">{pathname.startsWith('/admin') ? 'Platform administration' : 'Customer dashboard'}</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            {user.demoData && <span className="badge badge-soft-warning d-none d-md-inline-block">SAMPLE DATA ACCOUNT</span>}
            <div className="dropdown">
              <button className="btn btn-light d-flex align-items-center gap-2" data-bs-toggle="dropdown" aria-expanded="false">
                <span className="avatar-initials">{initials}</span>
                <span className="d-none d-md-inline text-truncate" style={{ maxWidth: 160 }}>{user.name}</span>
                <i className="bi bi-chevron-down small" />
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                <li className="px-3 py-2 border-bottom">
                  <div className="fw-semibold small text-truncate">{user.name}</div>
                  <div className="small text-secondary text-truncate">{user.email}</div>
                </li>
                {variant === 'customer' && (
                  <li>
                    <Link className="dropdown-item" href="/dashboard/settings"><i className="bi bi-gear me-2" />Settings</Link>
                  </li>
                )}
                <li>
                  <Link className="dropdown-item" href="/dashboard/help"><i className="bi bi-question-circle me-2" />Help &amp; support</Link>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item text-danger" onClick={logout}><i className="bi bi-box-arrow-right me-2" />Sign out</button>
                </li>
              </ul>
            </div>
          </div>
        </header>
        <main className="dash-content">{children}</main>
        <footer className="py-3 border-top text-secondary small text-center">
          © {new Date().getFullYear()} DorlaCode · Not affiliated with Meta Platforms, Inc.
        </footer>
      </div>
      <div className="toast-host toast-container position-fixed bottom-0 end-0 p-3" />
    </div>
  )
}
