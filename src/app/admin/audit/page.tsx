'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { Loading, ErrorState, Pagination } from '@/components/ui'

type AuditRow = {
  id: string
  action: string
  actorEmail?: string | null
  actorRole?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: unknown
  ip?: string | null
  createdAt: string
  actor?: { name: string; email: string; role: string } | null
}

export default function AdminAuditPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const { data, loading, error, refetch } = useApi<{ logs: AuditRow[]; totalPages: number; total: number }>(
    `/api/admin/audit?page=${page}&perPage=30&action=${encodeURIComponent(action)}`
  )

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">Audit logs</h1>
          <p className="text-secondary small mb-0">Security-relevant actions across the platform — authentication, pages, automations, campaigns, admin operations.</p>
        </div>
        <select className="form-select form-select-sm" style={{ maxWidth: 220 }} value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}>
          <option value="">All actions</option>
          <option value="auth.">Authentication</option>
          <option value="page.">Page management</option>
          <option value="automation.">Automations</option>
          <option value="campaign.">Campaigns</option>
          <option value="contact.">Contacts</option>
          <option value="admin.">Admin operations</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">When</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>IP</th>
                    <th className="pe-3">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.logs.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-secondary small py-4">No audit entries.</td></tr>
                  )}
                  {data!.logs.map((l) => (
                    <tr key={l.id}>
                      <td className="ps-3 small text-secondary text-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="small"><code className="text-primary">{l.action}</code></td>
                      <td className="small">
                        <div className="fw-semibold">{l.actor?.name ?? l.actorEmail ?? 'system'}</div>
                        <div className="text-secondary">{l.actor?.role ?? l.actorRole ?? ''}</div>
                      </td>
                      <td className="small text-secondary">{l.targetType ? `${l.targetType} ${(l.targetId ?? '').slice(0, 10)}…` : '—'}</td>
                      <td className="small text-secondary">{l.ip ?? '—'}</td>
                      <td className="small text-secondary text-truncate pe-3" style={{ maxWidth: 260 }}>
                        {l.metadata ? JSON.stringify(l.metadata) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
    </div>
  )
}
