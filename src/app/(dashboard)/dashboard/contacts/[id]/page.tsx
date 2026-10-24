'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, StatusBadge, ConfirmDialog, showToast } from '@/components/ui'

type Tag = { id: string; name: string; color: string }
type ContactDetail = {
  id: string
  fbPsid: string
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  source?: string | null
  messagingState: string
  messagingWindowUntil?: string | null
  optedOutAt?: string | null
  notes?: string | null
  isSample: boolean
  firstInteractionAt: string
  lastInteractionAt: string
  page?: { id: string; name: string } | null
  tags: Tag[]
}
type MessageRow = {
  id: string
  direction: string
  status: string
  body: string
  error?: string | null
  skipReason?: string | null
  campaign?: { name: string } | null
  automation?: { type: string } | null
  sentAt?: string | null
  createdAt: string
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, loading, error, refetch } = useApi<{ contact: ContactDetail; messages: MessageRow[] }>(`/api/contacts/${id}`)
  const tagsQ = useApi<{ tags: Tag[] }>('/api/contacts/tags')
  const [notes, setNotes] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [confirmOptOut, setConfirmOptOut] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data?.contact) {
      setNotes(data.contact.notes ?? '')
      setSelectedTags(new Set(data.contact.tags.map((t) => t.id)))
    }
  }, [data])

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const c = data!.contact

  const savePatch = async (body: Record<string, unknown>, successMsg: string) => {
    setBusy(true)
    try {
      await apiCall(`/api/contacts/${id}`, 'PATCH', body)
      showToast(successMsg, 'success')
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const optOut = async () => {
    await savePatch({ optOut: true }, 'Contact marked as opted out. They will never receive campaign messages.')
    setConfirmOptOut(false)
  }

  const remove = async () => {
    setBusy(true)
    try {
      await apiCall(`/api/contacts/${id}`, 'DELETE')
      showToast('Contact deleted.', 'success')
      router.push('/dashboard/contacts')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'danger')
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div className="d-flex align-items-center gap-3">
          <Link href="/dashboard/contacts" className="btn btn-light border btn-sm"><i className="bi bi-arrow-left" /></Link>
          <span className="avatar-initials" style={{ width: 48, height: 48, fontSize: '1rem' }}>{(c.name || '?').slice(0, 2).toUpperCase()}</span>
          <div>
            <h1 className="h4 fw-bold mb-0">
              {c.name || 'Unnamed contact'} {c.isSample && <span className="badge badge-soft-warning">SAMPLE</span>}
            </h1>
            <div className="small text-secondary d-flex gap-2 align-items-center">
              <StatusBadge status={c.messagingState} />
              <span>PSID …{c.fbPsid.slice(-10)}</span>
              {c.page && <span>· via {c.page.name}</span>}
            </div>
          </div>
        </div>
        <div className="d-flex gap-2">
          {c.messagingState !== 'OPTED_OUT' && (
            <button className="btn btn-outline-warning btn-sm" onClick={() => setConfirmOptOut(true)} disabled={busy}>
              <i className="bi bi-slash-circle me-1" />Mark opted out
            </button>
          )}
          <button className="btn btn-outline-danger btn-sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
            <i className="bi bi-trash me-1" />Delete
          </button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-4 d-flex flex-column gap-3">
          <div className="card">
            <div className="card-header">Profile</div>
            <div className="card-body small d-grid gap-2">
              <div className="d-flex justify-content-between"><span className="text-secondary">First seen</span><span>{new Date(c.firstInteractionAt).toLocaleString()}</span></div>
              <div className="d-flex justify-content-between"><span className="text-secondary">Last interaction</span><span>{new Date(c.lastInteractionAt).toLocaleString()}</span></div>
              <div className="d-flex justify-content-between"><span className="text-secondary">Source</span><span>{c.source ?? '—'}</span></div>
              {c.messagingWindowUntil && (
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Window open until</span>
                  <span>{new Date(c.messagingWindowUntil).toLocaleString()}</span>
                </div>
              )}
              {c.optedOutAt && (
                <div className="d-flex justify-content-between text-danger"><span>Opted out</span><span>{new Date(c.optedOutAt).toLocaleString()}</span></div>
              )}
              <div>
                <div className="text-secondary mb-1">Note: Meta provides only Page-scoped identifiers and permitted profile fields — never email addresses.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Tags & segments</div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {(tagsQ.data?.tags ?? []).map((t) => {
                  const active = selectedTags.has(t.id)
                  return (
                    <button
                      key={t.id}
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
                      style={{ fontSize: '0.75rem' }}
                      disabled={busy}
                      onClick={() => {
                        const next = new Set(selectedTags)
                        if (active) next.delete(t.id)
                        else next.add(t.id)
                        setSelectedTags(next)
                        savePatch({ tagIds: [...next] }, 'Tags updated.')
                      }}
                    >
                      {t.name}
                    </button>
                  )
                })}
                {(tagsQ.data?.tags ?? []).length === 0 && <span className="small text-secondary">Create tags from the Contacts page to segment your audience.</span>}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Notes</div>
            <div className="card-body">
              <textarea className="form-control form-control-sm" rows={4} value={notes} onChange={(e) => { setNotes(e.target.value); setNotesDirty(true) }} placeholder="Internal notes about this contact…" maxLength={2000} />
              {notesDirty && (
                <button className="btn btn-sm btn-primary mt-2" disabled={busy} onClick={() => savePatch({ notes }, 'Notes saved.')}>
                  <i className="bi bi-save me-1" />Save notes
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">Message history (latest 50)</div>
            <div className="card-body p-0" style={{ maxHeight: 620, overflowY: 'auto' }}>
              {data!.messages.length === 0 ? (
                <div className="text-center text-secondary py-5 small">No messages recorded for this contact yet.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {data!.messages.map((m) => (
                    <li key={m.id} className="list-group-item px-3 py-2">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="small">
                          <span className={`fw-semibold ${m.direction === 'OUTGOING' ? 'text-primary' : 'text-success'}`}>
                            <i className={`bi ${m.direction === 'OUTGOING' ? 'bi-arrow-up-right' : 'bi-arrow-down-left'} me-1`} />
                            {m.direction === 'OUTGOING' ? 'Sent by you' : 'Received'}
                          </span>
                          {m.campaign && <span className="text-secondary"> · campaign “{m.campaign.name}”</span>}
                          {m.automation && <span className="text-secondary"> · {m.automation.type.replace(/_/g, ' ').toLowerCase()}</span>}
                          <div className="text-secondary" style={{ whiteSpace: 'pre-wrap' }}>{m.body || `(${m.skipReason ?? m.status.toLowerCase()})`}</div>
                          {m.error && <div className="text-danger">{m.error}</div>}
                        </div>
                        <div className="text-end">
                          <StatusBadge status={m.status} />
                          <div className="small text-secondary" style={{ fontSize: '0.68rem' }}>{new Date(m.createdAt).toLocaleString()}</div>
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

      <ConfirmDialog
        open={confirmOptOut}
        title="Mark as opted out"
        message="This contact will be excluded from all campaigns immediately. This cannot be undone automatically."
        confirmLabel="Opt out"
        busy={busy}
        onConfirm={optOut}
        onCancel={() => setConfirmOptOut(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete contact"
        message="Delete this contact and their tag assignments? Message history rows remain for audit purposes but lose their link to this contact."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
