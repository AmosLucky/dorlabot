'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, EmptyState, StatusBadge, Pagination, showToast } from '@/components/ui'

type Tag = { id: string; name: string; color: string; contactCount: number }
type ContactRow = {
  id: string
  fbPsid: string
  name?: string | null
  source?: string | null
  messagingState: string
  messagingWindowUntil?: string | null
  optedOutAt?: string | null
  isSample: boolean
  firstInteractionAt: string
  lastInteractionAt: string
  page?: { id: string; name: string } | null
  tags: Tag[]
  messageCount: number
}

const STATE_FILTERS = [
  { value: '', label: 'All contacts' },
  { value: 'ELIGIBLE', label: 'Eligible now' },
  { value: 'UNKNOWN', label: 'Interacted (no window)' },
  { value: 'INELIGIBLE', label: 'Window closed' },
  { value: 'OPTED_OUT', label: 'Opted out' },
]

export default function ContactsClient() {
  const params = useSearchParams()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [state, setState] = useState(params.get('state') ?? '')
  const [tagId, setTagId] = useState('')
  const [page, setPage] = useState(1)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [newTag, setNewTag] = useState('')

  const contactsQ = useApi<{ contacts: ContactRow[]; total: number; totalPages: number }>(
    `/api/contacts?page=${page}&perPage=20&q=${encodeURIComponent(query)}&state=${state}&tagId=${tagId}`
  )
  const tagsQ = useApi<{ tags: Tag[] }>('/api/contacts/tags')

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(q)
    setPage(1)
  }

  const createTag = async () => {
    if (!newTag.trim()) return
    try {
      await apiCall('/api/contacts/tags', 'POST', { name: newTag.trim() })
      setNewTag('')
      tagsQ.refetch()
      showToast('Tag created.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create tag', 'danger')
    }
  }

  const exportUrl = `/api/contacts/export?q=${encodeURIComponent(query)}&state=${state}&tagId=${tagId}`

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">Contacts</h1>
          <p className="text-secondary small mb-0">People who interacted with your Pages. Messaging eligibility is tracked per Meta rules — commenters are not automatically subscribers.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm" onClick={() => setTagModalOpen(!tagModalOpen)}>
            <i className="bi bi-tags me-1" />Manage tags
          </button>
          <a href={exportUrl} className="btn btn-outline-primary btn-sm">
            <i className="bi bi-download me-1" />Export CSV
          </a>
        </div>
      </div>

      {tagModalOpen && (
        <div className="card mb-3">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">Tags</h6>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {(tagsQ.data?.tags ?? []).map((t) => (
                <span key={t.id} className="badge badge-soft-primary d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                  <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: t.color }} />
                  {t.name} <span className="opacity-75">({t.contactCount})</span>
                  <button
                    className="btn btn-link p-0 text-danger ms-1"
                    style={{ fontSize: '0.7rem' }}
                    aria-label={`Delete tag ${t.name}`}
                    onClick={async () => {
                      try {
                        await apiCall(`/api/contacts/tags?id=${t.id}`, 'DELETE')
                        tagsQ.refetch()
                        contactsQ.refetch()
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Delete failed', 'danger')
                      }
                    }}
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </span>
              ))}
              {(tagsQ.data?.tags ?? []).length === 0 && <span className="small text-secondary">No tags yet.</span>}
            </div>
            <div className="d-flex gap-2" style={{ maxWidth: 360 }}>
              <input className="form-control form-control-sm" placeholder="New tag name" value={newTag} maxLength={40} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTag()} />
              <button className="btn btn-sm btn-primary" onClick={createTag}><i className="bi bi-plus-lg" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-5">
              <form onSubmit={search} className="d-flex gap-2">
                <input className="form-control form-control-sm" placeholder="Search by name or PSID…" value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="btn btn-sm btn-primary" type="submit"><i className="bi bi-search" /></button>
              </form>
            </div>
            <div className="col-md-4">
              <select className="form-select form-select-sm" value={state} onChange={(e) => { setState(e.target.value); setPage(1) }}>
                {STATE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={tagId} onChange={(e) => { setTagId(e.target.value); setPage(1) }}>
                <option value="">Any tag</option>
                {(tagsQ.data?.tags ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {contactsQ.loading ? (
            <Loading />
          ) : contactsQ.error ? (
            <ErrorState message={contactsQ.error} onRetry={contactsQ.refetch} />
          ) : contactsQ.data!.contacts.length === 0 ? (
            <EmptyState
              icon="bi-people"
              title="No contacts yet"
              description="Contacts are created automatically when people message your Page or comment on eligible posts. They respect Meta's Page-scoped identifiers — no email scraping, ever."
            />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Contact</th>
                    <th>Page</th>
                    <th>Messaging state</th>
                    <th>Tags</th>
                    <th>Messages</th>
                    <th>Last interaction</th>
                  </tr>
                </thead>
                <tbody>
                  {contactsQ.data!.contacts.map((c) => (
                    <tr key={c.id}>
                      <td className="ps-3">
                        <Link href={`/dashboard/contacts/${c.id}`} className="d-flex align-items-center gap-2 text-decoration-none">
                          <span className="avatar-initials">{(c.name || '?').slice(0, 2).toUpperCase()}</span>
                          <span>
                            <span className="fw-semibold text-dark d-block">
                              {c.name || 'Unnamed'} {c.isSample && <span className="badge badge-soft-warning">SAMPLE</span>}
                            </span>
                            <span className="small text-secondary">PSID …{c.fbPsid.slice(-8)}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="small">{c.page?.name ?? '—'}</td>
                      <td>
                        <StatusBadge status={c.messagingState} />
                        {c.messagingWindowUntil && c.messagingState === 'ELIGIBLE' && (
                          <div className="small text-secondary">until {new Date(c.messagingWindowUntil).toLocaleString()}</div>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <span key={t.id} className="badge badge-soft-secondary" style={{ fontSize: '0.65rem' }}>{t.name}</span>
                          ))}
                        </div>
                      </td>
                      <td>{c.messageCount}</td>
                      <td className="small text-secondary">{new Date(c.lastInteractionAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Pagination page={page} totalPages={contactsQ.data?.totalPages ?? 1} onPage={setPage} />
      <p className="small text-secondary mt-3">
        <i className="bi bi-info-circle me-1" />
        <strong>Eligible now</strong> = open 24h messaging window (person messaged your Page). <strong>Interacted</strong> = we know this person, but Meta rules do not currently permit standard messages.
      </p>
    </div>
  )
}
