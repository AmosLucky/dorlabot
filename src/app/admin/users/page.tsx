'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, EmptyState, StatusBadge, Pagination, ConfirmDialog, showToast } from '@/components/ui'

type UserRow = {
  id: string
  name: string
  email: string
  status: string
  role: string
  emailVerifiedAt?: string | null
  createdAt: string
  lastLoginAt?: string | null
  twoFactorEnabled: boolean
  demoData: boolean
  _count: { pages: number; contacts: number; campaigns: number; messages: number }
}

function UsersInner() {
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<{ user: UserRow; kind: 'suspend' | 'reactivate' | 'delete' } | null>(null)
  const [busy, setBusy] = useState(false)

  const usersQ = useApi<{ users: UserRow[]; total: number; totalPages: number }>(
    `/api/admin/users?page=${page}&perPage=20&q=${encodeURIComponent(query)}&status=${status}`
  )

  const runAction = async () => {
    if (!action) return
    setBusy(true)
    try {
      if (action.kind === 'delete') {
        await apiCall(`/api/admin/users?userId=${action.user.id}`, 'DELETE')
        showToast(`${action.user.email} deleted with all their data.`, 'success')
      } else {
        await apiCall('/api/admin/users', 'PATCH', { userId: action.user.id, action: action.kind, reason: action.kind === 'suspend' ? 'Suspended via admin console' : undefined })
        showToast(`${action.user.email} ${action.kind === 'suspend' ? 'suspended' : 'reactivated'}.`, 'success')
      }
      setAction(null)
      usersQ.refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const users = usersQ.data?.users ?? []

  return (
    <div>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">Customer accounts</h1>
        <p className="text-secondary small mb-0">Search, inspect usage, and manage account status. All actions are audit-logged.</p>
      </div>

      <div className="card mb-3">
        <div className="card-body py-3">
          <div className="row g-2">
            <div className="col-md-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setQuery(q)
                  setPage(1)
                }}
                className="d-flex gap-2"
              >
                <input className="form-control form-control-sm" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-search" /></button>
              </form>
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {usersQ.loading ? (
            <Loading />
          ) : usersQ.error ? (
            <ErrorState message={usersQ.error} onRetry={usersQ.refetch} />
          ) : users.length === 0 ? (
            <EmptyState icon="bi-people" title="No customers found" description="No registered customers match this search." />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Customer</th>
                    <th>Status</th>
                    <th>Usage</th>
                    <th>Registered</th>
                    <th>Last login</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="ps-3">
                        <div className="d-flex align-items-center gap-2">
                          <span className="avatar-initials">{u.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <div className="fw-semibold d-flex gap-2 align-items-center">
                              {u.name}
                              {u.demoData && <span className="badge badge-soft-warning">SAMPLE</span>}
                              {u.twoFactorEnabled && <i className="bi bi-shield-lock text-success" title="2FA enabled" />}
                            </div>
                            <div className="small text-secondary">{u.email} · {u.emailVerifiedAt ? 'verified' : 'unverified'}</div>
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge status={u.status} /></td>
                      <td className="small text-secondary">
                        {u._count.pages} pages · {u._count.contacts} contacts<br />
                        {u._count.campaigns} campaigns · {u._count.messages} messages
                      </td>
                      <td className="small text-secondary">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="small text-secondary">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                      <td className="text-end pe-3">
                        <div className="btn-group btn-group-sm">
                          {u.status === 'ACTIVE' ? (
                            <button className="btn btn-outline-warning" onClick={() => setAction({ user: u, kind: 'suspend' })} title="Suspend">
                              <i className="bi bi-pause-circle" />
                            </button>
                          ) : (
                            <button className="btn btn-outline-success" onClick={() => setAction({ user: u, kind: 'reactivate' })} title="Reactivate">
                              <i className="bi bi-play-circle" />
                            </button>
                          )}
                          <button className="btn btn-outline-danger" onClick={() => setAction({ user: u, kind: 'delete' })} title="Delete account">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Pagination page={page} totalPages={usersQ.data?.totalPages ?? 1} onPage={setPage} />

      <ConfirmDialog
        open={action !== null}
        title={action?.kind === 'suspend' ? 'Suspend account' : action?.kind === 'reactivate' ? 'Reactivate account' : 'Delete account'}
        message={
          action?.kind === 'suspend'
            ? `Suspend ${action?.user.email}? Their sessions are revoked, active automations pause, and they cannot sign in.`
            : action?.kind === 'reactivate'
              ? `Reactivate ${action?.user.email}? They can sign in again and re-enable automations.`
              : `PERMANENTLY delete ${action?.user.email} and all associated Pages, automations, contacts, campaigns, and messages? This cannot be undone.`
        }
        confirmLabel={action?.kind === 'suspend' ? 'Suspend' : action?.kind === 'reactivate' ? 'Reactivate' : 'Delete permanently'}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setAction(null)}
      />
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UsersInner />
    </Suspense>
  )
}
