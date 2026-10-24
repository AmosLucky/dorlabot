'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { Loading, ErrorState, EmptyState, StatusBadge, Pagination } from '@/components/ui'

type MessageRow = {
  id: string
  direction: string
  status: string
  body: string
  error?: string | null
  skipReason?: string | null
  createdAt: string
  sentAt?: string | null
  contact?: { id: string; name?: string | null } | null
  page: { id: string; name: string }
  campaign?: { id: string; name: string } | null
  automation?: { id: string; type: string; name: string } | null
}

export default function ActivityPage() {
  const [direction, setDirection] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const q = useApi<{ messages: MessageRow[]; total: number; totalPages: number }>(
    `/api/messages?page=${page}&perPage=25&direction=${direction}&status=${status}`
  )

  return (
    <div>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">Message Activity</h1>
        <p className="text-secondary small mb-0">Every inbound and outbound Messenger event, with processing outcomes and reasons.</p>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2">
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1) }}>
                <option value="">All directions</option>
                <option value="OUTGOING">Outgoing</option>
                <option value="INCOMING">Incoming</option>
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                <option value="">All statuses</option>
                {['SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'RECEIVED'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {q.loading ? (
            <Loading />
          ) : q.error ? (
            <ErrorState message={q.error} onRetry={q.refetch} />
          ) : q.data!.messages.length === 0 ? (
            <EmptyState icon="bi-chat-left-text" title="No messages yet" description="Once a Page is connected and people interact with your automations or campaigns, all events appear here with their outcomes." />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Direction</th>
                    <th>Contact</th>
                    <th>Page</th>
                    <th>Message</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th className="pe-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data!.messages.map((m) => (
                    <tr key={m.id}>
                      <td className="ps-3">
                        <i className={`bi ${m.direction === 'OUTGOING' ? 'bi-arrow-up-right text-primary' : 'bi-arrow-down-left text-success'}`} title={m.direction} />
                      </td>
                      <td className="small">
                        {m.contact ? (
                          <Link href={`/dashboard/contacts/${m.contact.id}`}>{m.contact.name || 'Unnamed'}</Link>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                      <td className="small">{m.page.name}</td>
                      <td className="small text-truncate" style={{ maxWidth: 260 }}>
                        {m.body || <span className="text-secondary">({m.skipReason ?? m.status.toLowerCase()})</span>}
                        {m.error && <div className="text-danger small">{m.error}</div>}
                      </td>
                      <td className="small text-secondary">
                        {m.campaign ? `Campaign: ${m.campaign.name}` : m.automation ? `Automation: ${m.automation.name}` : '—'}
                      </td>
                      <td><StatusBadge status={m.status} /></td>
                      <td className="small text-secondary pe-3">{new Date(m.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Pagination page={page} totalPages={q.data?.totalPages ?? 1} onPage={setPage} />
    </div>
  )
}
