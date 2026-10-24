import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getDashboardStats } from '@/server/stats'
import MetaSetupNotice from '@/components/MetaSetupNotice'
import { StatusBadge, EmptyState } from '@/components/ui'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const stats = await getDashboardStats(user.id)

  const cards = [
    { label: 'Connected Pages', value: `${stats.activePages}/${stats.pages}`, icon: 'bi-flag', href: '/dashboard/pages' },
    { label: 'Total contacts', value: stats.contacts.toLocaleString(), icon: 'bi-people', href: '/dashboard/contacts' },
    { label: 'Active automations', value: `${stats.activeAutomations}/${stats.totalAutomations}`, icon: 'bi-lightning-charge', href: '/dashboard/automations/comment' },
    { label: 'Messages sent', value: stats.messagesSent.toLocaleString(), icon: 'bi-send', href: '/dashboard/activity' },
    { label: 'Eligible campaign audience', value: stats.eligibleContacts.toLocaleString(), icon: 'bi-person-check', href: '/dashboard/campaigns' },
    { label: 'Tracked link clicks', value: stats.clicks.toLocaleString(), icon: 'bi-mouse2', href: '/dashboard/analytics' },
  ]

  const fresh = stats.pages === 0 && stats.totalAutomations === 0

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">Welcome back, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-secondary small mb-0">Here&apos;s what&apos;s happening across your connected Pages.</p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/dashboard/pages" className="btn btn-outline-primary btn-sm">
            <i className="bi bi-flag me-1" />Pages
          </Link>
          <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm">
            <i className="bi bi-megaphone me-1" />New campaign
          </Link>
        </div>
      </div>

      <MetaSetupNotice />

      {stats.messagesFailed > 0 && (
        <div className="alert alert-warning py-2 small d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle" />
          <span>{stats.messagesFailed} message send(s) failed recently — review the outcomes in <Link href="/dashboard/activity">Message Activity</Link>.</span>
        </div>
      )}

      <div className="row g-3 mb-4">
        {cards.map((c) => (
          <div className="col-6 col-lg-4 col-xxl-2" key={c.label}>
            <Link href={c.href} className="text-decoration-none">
              <div className="card stat-card h-100 hover-lift">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="stat-label">{c.label}</span>
                    <span className="stat-icon"><i className={`bi ${c.icon}`} /></span>
                  </div>
                  <div className="stat-value">{c.value}</div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {fresh && (
        <div className="card mb-4 border-primary">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap gap-3 align-items-center">
              <span className="feature-icon"><i className="bi bi-rocket-takeoff" /></span>
              <div className="flex-grow-1">
                <h5 className="fw-semibold mb-1">Get started in 3 steps</h5>
                <ol className="text-secondary small mb-0 ps-3">
                  <li><Link href="/dashboard/pages">Connect a Facebook Page</Link> through the official Meta authorization flow.</li>
                  <li>Create a <Link href="/dashboard/automations/comment">comment-to-DM automation</Link> and choose your trigger rules.</li>
                  <li><Link href="/dashboard/campaigns/new">Launch a campaign</Link> to contacts with an open messaging window.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Recent campaigns</span>
              <Link href="/dashboard/campaigns" className="small">View all</Link>
            </div>
            <div className="card-body p-0">
              {stats.recentCampaigns.length === 0 ? (
                <EmptyState icon="bi-megaphone" title="No campaigns yet" description="Create your first broadcast campaign to reach eligible contacts with an open messaging window." action={<Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm">Create campaign</Link>} />
              ) : (
                <ul className="list-group list-group-flush">
                  {stats.recentCampaigns.map((c) => (
                    <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center px-3">
                      <div className="text-truncate me-2">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="fw-semibold text-truncate d-block">{c.name}</Link>
                        <span className="small text-secondary">{c.sentCount}/{c.totalRecipients} sent · {c.eligibleCount} eligible</span>
                      </div>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Recent message activity</span>
              <Link href="/dashboard/activity" className="small">View all</Link>
            </div>
            <div className="card-body p-0">
              {stats.recentMessages.length === 0 ? (
                <EmptyState icon="bi-chat-left-text" title="No messages yet" description="Once your Page is connected and automations run, every send and reply appears here." />
              ) : (
                <ul className="list-group list-group-flush">
                  {stats.recentMessages.map((m) => (
                    <li key={m.id} className="list-group-item px-3">
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <div className="text-truncate">
                          <i className={`bi ${m.direction === 'OUTGOING' ? 'bi-arrow-up-right text-primary' : 'bi-arrow-down-left text-success'} me-2`} />
                          <span className="small fw-semibold">{m.contact?.name || 'Unknown contact'}</span>
                          <span className="small text-secondary"> · {m.page?.name}</span>
                          <div className="small text-secondary text-truncate">{m.body || `(${m.status.toLowerCase()})`}</div>
                        </div>
                        <div className="text-end">
                          <StatusBadge status={m.status} />
                          <div className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
