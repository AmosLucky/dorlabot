'use client'

import { useState } from 'react'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, EmptyState, StatusBadge, ConfirmDialog, showToast } from '@/components/ui'
import AutomationEditor, { type AutomationForm, type PageOption } from '@/components/automations/AutomationEditor'
import MetaSetupNotice from '@/components/MetaSetupNotice'

type AutomationRow = {
  id: string
  type: 'COMMENT_REPLY' | 'WELCOME_MESSAGE' | 'DEFAULT_REPLY'
  name: string
  status: 'ACTIVE' | 'PAUSED'
  replyTemplate?: string | null
  fallbackReply?: string | null
  matchMode?: string | null
  enabledPosts?: unknown
  rules: { keyword: string; matchType: string }[]
  triggeredCount: number
  sentCount: number
  skippedCount: number
  failedCount: number
  lastRunAt?: string | null
  lastError?: string | null
  page: { id: string; name: string; status: string }
}

export default function AutomationsListClient({ types, title, description, empty }: { types: AutomationForm['type'][]; title: string; description: string; empty: { icon: string; title: string; text: string } }) {
  const { data, loading, error, refetch } = useApi<{ automations: AutomationRow[] }>(`/api/automations${types.length === 1 ? `?type=${types[0]}` : ''}`)
  const pagesQ = useApi<{ pages: PageOption[] }>('/api/facebook/pages')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<(Partial<AutomationForm> & { id: string }) | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AutomationRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const automations = (data?.automations ?? []).filter((a) => types.includes(a.type))
  const pages = pagesQ.data?.pages ?? []

  const toggle = async (a: AutomationRow) => {
    setBusyId(a.id)
    try {
      await apiCall(`/api/automations/${a.id}`, 'PATCH', { status: a.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })
      showToast(a.status === 'ACTIVE' ? 'Automation paused.' : 'Automation activated.', 'success')
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return
    setBusyId(confirmDelete.id)
    try {
      await apiCall(`/api/automations/${confirmDelete.id}`, 'DELETE')
      showToast('Automation deleted.', 'success')
      setConfirmDelete(null)
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">{title}</h1>
          <p className="text-secondary small mb-0">{description}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null)
            setEditorOpen(true)
          }}
        >
          <i className="bi bi-plus-lg me-1" />New automation
        </button>
      </div>

      <MetaSetupNotice />

      <div className="card">
        <div className="card-body p-0">
          {loading || pagesQ.loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : automations.length === 0 ? (
            <EmptyState
              icon={empty.icon}
              title={pages.length === 0 ? 'Connect a Page first' : empty.title}
              description={pages.length === 0 ? 'Automations attach to connected Facebook Pages. Connect one to get started.' : empty.text}
              action={
                <button
                  className="btn btn-primary"
                  disabled={pages.filter((p) => p.status === 'CONNECTED').length === 0}
                  onClick={() => {
                    setEditing(null)
                    setEditorOpen(true)
                  }}
                >
                  <i className="bi bi-plus-lg me-1" />Create automation
                </button>
              }
            />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Automation</th>
                    <th>Page</th>
                    <th>Status</th>
                    <th>Performance</th>
                    <th>Last run</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {automations.map((a) => (
                    <tr key={a.id}>
                      <td className="ps-3">
                        <div className="fw-semibold">{a.name}</div>
                        <div className="small text-secondary text-truncate" style={{ maxWidth: 320 }}>
                          {a.type === 'DEFAULT_REPLY' && a.fallbackReply ? 'Keyword + fallback replies' : a.replyTemplate}
                        </div>
                        {a.rules.length > 0 && (
                          <div className="mt-1 d-flex flex-wrap gap-1">
                            {a.rules.slice(0, 4).map((r) => (
                              <span key={r.keyword} className="badge badge-soft-primary" style={{ fontSize: '0.65rem' }}>{r.keyword}</span>
                            ))}
                            {a.rules.length > 4 && <span className="badge badge-soft-secondary" style={{ fontSize: '0.65rem' }}>+{a.rules.length - 4}</span>}
                          </div>
                        )}
                        {a.lastError && <div className="small text-danger mt-1"><i className="bi bi-exclamation-triangle me-1" />{a.lastError}</div>}
                      </td>
                      <td>
                        <div className="small fw-semibold">{a.page.name}</div>
                        <StatusBadge status={a.page.status} />
                      </td>
                      <td><StatusBadge status={a.status} /></td>
                      <td className="small">
                        <span className="text-success">{a.sentCount} sent</span>
                        {a.skippedCount > 0 && <span className="text-warning"> · {a.skippedCount} skipped</span>}
                        {a.failedCount > 0 && <span className="text-danger"> · {a.failedCount} failed</span>}
                        <div className="text-secondary">{a.triggeredCount} trigger{a.triggeredCount === 1 ? '' : 's'}</div>
                      </td>
                      <td className="small text-secondary">{a.lastRunAt ? new Date(a.lastRunAt).toLocaleString() : 'Never'}</td>
                      <td className="text-end pe-3">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" onClick={() => toggle(a)} disabled={busyId === a.id} title={a.status === 'ACTIVE' ? 'Pause' : 'Activate'}>
                            <i className={`bi ${a.status === 'ACTIVE' ? 'bi-pause' : 'bi-play'}`} />
                          </button>
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => {
                              setEditing({
                                id: a.id,
                                pageId: a.page.id,
                                type: a.type,
                                name: a.name,
                                replyTemplate: a.replyTemplate ?? '',
                                fallbackReply: a.fallbackReply ?? '',
                                matchMode: (a.matchMode as AutomationForm['matchMode']) ?? 'any',
                                enabledPosts: (a.enabledPosts as string[] | null) ?? ['ALL'],
                                rules: a.rules.map((r) => ({ keyword: r.keyword, matchType: r.matchType as never, isActive: true })),
                                status: a.status,
                              })
                              setEditorOpen(true)
                            }}
                            title="Edit"
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="btn btn-outline-danger" onClick={() => setConfirmDelete(a)} title="Delete">
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

      <AutomationEditor
        open={editorOpen}
        type={types[0]}
        pages={pages}
        automation={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete automation"
        message={`Delete "${confirmDelete?.name}"? Message history is kept, but the automation stops immediately.`}
        confirmLabel="Delete"
        busy={busyId !== null}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
