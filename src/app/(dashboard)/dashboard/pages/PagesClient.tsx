'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, EmptyState, StatusBadge, ConfirmDialog, showToast } from '@/components/ui'
import MetaSetupNotice from '@/components/MetaSetupNotice'
import { useState } from 'react'

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
  tokenExpiresAt?: string | null
  isSample: boolean
  _count: { contacts: number; automations: number; messages: number }
}

const ERROR_MESSAGES: Record<string, string> = {
  meta_not_configured: 'Meta app credentials are not configured on the server yet — see the notice below.',
  authorization_denied: 'You declined the Facebook authorization. You can try again at any time.',
  invalid_state: 'The connection request expired or was tampered with. Please try connecting again.',
  missing_params: 'Facebook returned an incomplete response. Please try again.',
  token_invalid: 'The token returned by Facebook was not valid. Please try again.',
  no_pages: 'No Facebook Pages are manageable by your account. Create a Page or get admin access first.',
  graph_error: 'Facebook returned an error during connection. Check your Meta app configuration and try again.',
  unexpected: 'Something went wrong while connecting. Please try again.',
}

export default function PagesClient() {
  const params = useSearchParams()
  const errorCode = params.get('error')
  const { data, loading, error, refetch } = useApi<{ pages: PageRow[] }>('/api/facebook/pages')
  const [confirmDisconnect, setConfirmDisconnect] = useState<PageRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const pages = data?.pages ?? []

  const disconnect = async () => {
    if (!confirmDisconnect) return
    setBusyId(confirmDisconnect.id)
    try {
      await apiCall(`/api/facebook/pages/${confirmDisconnect.id}`, 'DELETE')
      showToast(`${confirmDisconnect.name} disconnected. Automations were paused.`, 'success')
      setConfirmDisconnect(null)
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Disconnect failed', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  const sync = async (page: PageRow) => {
    setBusyId(page.id)
    try {
      await apiCall(`/api/facebook/pages/${page.id}`, 'PATCH', { action: 'sync' })
      showToast(`${page.name} synced successfully.`, 'success')
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync failed', 'danger')
      refetch()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">Facebook Pages</h1>
          <p className="text-secondary small mb-0">Connect Pages through the official Meta authorization flow.</p>
        </div>
        <a href="/api/facebook/connect" className="btn btn-primary">
          <i className="bi bi-plus-circle me-1" />Connect Facebook Page
        </a>
      </div>

      {errorCode && (
        <div className="alert alert-danger small d-flex align-items-start gap-2">
          <i className="bi bi-exclamation-octagon mt-1" />
          <div>
            <strong>Connection problem:</strong> {ERROR_MESSAGES[errorCode] ?? 'An unknown error occurred.'}
          </div>
        </div>
      )}

      <MetaSetupNotice />

      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : pages.length === 0 ? (
            <EmptyState
              icon="bi-flag"
              title="No Pages connected yet"
              description="Connect a Facebook Page you manage to unlock comment automation, welcome messages, and campaigns. The connection uses Facebook's official login — we never see your password, and Page tokens are stored encrypted."
              action={
                <a href="/api/facebook/connect" className="btn btn-primary">
                  <i className="bi bi-facebook me-1" />Connect Facebook Page
                </a>
              }
            />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Page</th>
                    <th>Status</th>
                    <th>Webhook</th>
                    <th>Automations</th>
                    <th>Contacts</th>
                    <th>Last synced</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id}>
                      <td className="ps-3">
                        <div className="d-flex align-items-center gap-2">
                          <span className="avatar-initials" style={{ background: '#e8f0fe', color: '#1967d2' }}>
                            <i className="bi bi-flag" />
                          </span>
                          <div>
                            <div className="fw-semibold d-flex align-items-center gap-2">
                              {p.name} {p.isSample && <span className="badge badge-soft-warning">SAMPLE</span>}
                            </div>
                            <div className="small text-secondary">ID {p.fbPageId} · connected {new Date(p.connectedAt).toLocaleDateString()}</div>
                            {p.lastError && <div className="small text-danger"><i className="bi bi-exclamation-triangle me-1" />{p.lastError}</div>}
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        {p.webhookSubscribed ? (
                          <span className="badge badge-soft-success"><i className="bi bi-check2 me-1" />Subscribed</span>
                        ) : (
                          <span className="badge badge-soft-warning"><i className="bi bi-slash-circle me-1" />Not subscribed</span>
                        )}
                      </td>
                      <td>{p._count.automations}</td>
                      <td>{p._count.contacts}</td>
                      <td className="small text-secondary">
                        {p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleString() : '—'}
                        {p.status === 'TOKEN_EXPIRED' && <div className="text-danger small">Reconnect required</div>}
                      </td>
                      <td className="text-end pe-3">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" onClick={() => sync(p)} disabled={busyId === p.id || p.status === 'DISCONNECTED'} title="Sync page details and webhook subscription">
                            <i className={`bi ${busyId === p.id ? 'bi-arrow-repeat spinner-rotate' : 'bi-arrow-repeat'}`} />
                          </button>
                          <Link href={`/dashboard/automations/comment?page=${p.id}`} className="btn btn-outline-secondary" title="Automations">
                            <i className="bi bi-sliders" />
                          </Link>
                          <button className="btn btn-outline-danger" onClick={() => setConfirmDisconnect(p)} disabled={p.status === 'DISCONNECTED'} title="Disconnect">
                            <i className="bi bi-plug" />
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

      <p className="small text-secondary mt-3">
        <i className="bi bi-shield-lock me-1" />
        Page access tokens are encrypted with AES-256-GCM at rest and are never displayed in this dashboard or returned by any API.
      </p>

      <ConfirmDialog
        open={confirmDisconnect !== null}
        title="Disconnect Page"
        message={`Disconnect "${confirmDisconnect?.name}"? Automations will be paused, the stored token will be destroyed, and no further events will be processed. Contacts and history are kept.`}
        confirmLabel="Disconnect"
        busy={busyId !== null}
        onConfirm={disconnect}
        onCancel={() => setConfirmDisconnect(null)}
      />
    </div>
  )
}
