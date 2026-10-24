'use client'

import { useApi } from '@/hooks/useApi'
import { Loading, ErrorState, EmptyState, StatusBadge } from '@/components/ui'

type PageRow = {
  id: string
  fbPageId: string
  name: string
  category?: string | null
  status: string
  webhookSubscribed: boolean
  lastError?: string | null
  lastSyncedAt?: string | null
  connectedAt: string
  isSample: boolean
  user: { id: string; name: string; email: string; status: string }
  _count: { automations: number; contacts: number; messages: number; webhookEvents: number }
}

export default function AdminPagesPage() {
  const { data, loading, error, refetch } = useApi<{ pages: PageRow[] }>('/api/admin/pages')
  const pages = data?.pages ?? []

  return (
    <div>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">Connected Facebook Pages</h1>
        <p className="text-secondary small mb-0">Connection status, webhook health, and owners. Access tokens are never shown.</p>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : pages.length === 0 ? (
            <EmptyState icon="bi-flag" title="No Pages connected" description="No customers have connected a Facebook Page yet." />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Page</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Webhook</th>
                    <th>Usage</th>
                    <th>Connected</th>
                    <th>Last sync</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id}>
                      <td className="ps-3">
                        <div className="fw-semibold d-flex align-items-center gap-2">
                          {p.name} {p.isSample && <span className="badge badge-soft-warning">SAMPLE</span>}
                        </div>
                        <div className="small text-secondary">ID {p.fbPageId}{p.category ? ` · ${p.category}` : ''}</div>
                        {p.lastError && <div className="small text-danger"><i className="bi bi-exclamation-triangle me-1" />{p.lastError}</div>}
                      </td>
                      <td className="small">
                        <div className="fw-semibold">{p.user.name}</div>
                        <div className="text-secondary">{p.user.email}</div>
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        {p.webhookSubscribed ? (
                          <span className="badge badge-soft-success">Subscribed</span>
                        ) : (
                          <span className="badge badge-soft-warning">Not subscribed</span>
                        )}
                      </td>
                      <td className="small text-secondary">
                        {p._count.automations} automations · {p._count.contacts} contacts<br />
                        {p._count.messages} messages · {p._count.webhookEvents} events
                      </td>
                      <td className="small text-secondary">{new Date(p.connectedAt).toLocaleDateString()}</td>
                      <td className="small text-secondary">{p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
