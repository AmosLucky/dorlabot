import Link from 'next/link'
import { getAdminStats } from '@/server/stats'
import { StatusBadge } from '@/components/ui'
import MetaSetupNotice from '@/components/MetaSetupNotice'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin · Overview' }
export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const stats = await getAdminStats()

  const sections = [
    {
      title: 'Customers',
      icon: 'bi-people',
      items: [
        { label: 'Registered', value: stats.totalUsers },
        { label: 'Active', value: stats.activeUsers },
        { label: 'Suspended', value: stats.suspendedUsers },
        { label: 'Verified emails', value: stats.verifiedUsers },
      ],
      link: { href: '/admin/users', label: 'Manage users' },
    },
    {
      title: 'Facebook Pages',
      icon: 'bi-flag',
      items: [
        { label: 'Total connections', value: stats.totalPages },
        { label: 'Connected now', value: stats.connectedPages },
        { label: 'Error / expired', value: stats.errorPages },
      ],
      link: { href: '/admin/pages', label: 'View Pages' },
    },
    {
      title: 'Messaging volume',
      icon: 'bi-send',
      items: [
        { label: 'Automations', value: `${stats.activeAutomations}/${stats.totalAutomations}` },
        { label: 'Campaigns', value: stats.totalCampaigns },
        { label: 'Messages sent', value: stats.messagesSent },
        { label: 'Messages failed', value: stats.messagesFailed },
      ],
      link: null,
    },
    {
      title: 'System health',
      icon: 'bi-activity',
      items: [
        { label: 'Webhook: pending', value: stats.pendingEvents },
        { label: 'Webhook: processed', value: stats.processedEvents },
        { label: 'Webhook: failed', value: stats.failedEvents },
        { label: 'Failed jobs', value: stats.failedJobs },
      ],
      link: { href: '/admin/monitoring', label: 'Open monitoring' },
    },
  ]

  return (
    <div>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">Platform overview</h1>
        <p className="text-secondary small mb-0">System-wide statistics. Secrets (tokens, keys, passwords) are never displayed here.</p>
      </div>

      <MetaSetupNotice />

      <div className="row g-3 mb-4">
        {sections.map((sec) => (
          <div className="col-md-6 col-xxl-3" key={sec.title}>
            <div className="card h-100">
              <div className="card-header d-flex align-items-center gap-2">
                <i className={`bi ${sec.icon} text-primary`} />
                {sec.title}
              </div>
              <div className="card-body p-0">
                <ul className="list-group list-group-flush">
                  {sec.items.map((it) => (
                    <li className="list-group-item d-flex justify-content-between align-items-center px-3" key={it.label}>
                      <span className="small text-secondary">{it.label}</span>
                      <span className="fw-bold">{typeof it.value === 'number' ? it.value.toLocaleString() : it.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {sec.link && (
                <div className="card-footer text-end py-2 bg-white">
                  <Link href={sec.link.href} className="small fw-semibold">{sec.link.label} <i className="bi bi-arrow-right" /></Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">Recent system activity</div>
            <ul className="list-group list-group-flush">
              {stats.recentAudit.length === 0 && <li className="list-group-item small text-secondary">No audit entries yet.</li>}
              {stats.recentAudit.map((a) => (
                <li className="list-group-item px-3 py-2 d-flex justify-content-between align-items-center gap-2" key={a.id}>
                  <div className="small text-truncate">
                    <code className="text-primary">{a.action}</code>
                    <span className="text-secondary"> · {a.actorEmail ?? 'system'}</span>
                    {a.targetType && <span className="text-secondary"> → {a.targetType} {a.targetId?.slice(0, 10)}…</span>}
                  </div>
                  <span className="small text-secondary text-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">Newest customers</div>
            <ul className="list-group list-group-flush">
              {stats.recentUsers.length === 0 && <li className="list-group-item small text-secondary">No customers registered yet.</li>}
              {stats.recentUsers.map((u) => (
                <li className="list-group-item px-3 py-2 d-flex justify-content-between align-items-center" key={u.id}>
                  <div className="small">
                    <Link href={`/admin/users?q=${encodeURIComponent(u.email)}`} className="fw-semibold">{u.name}</Link>
                    <div className="text-secondary">{u.email}</div>
                  </div>
                  <div className="text-end">
                    <StatusBadge status={u.status} />
                    <div className="small text-secondary">{new Date(u.createdAt).toLocaleDateString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
