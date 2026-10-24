'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiCall } from '@/hooks/useApi'
import { showToast, StatusBadge } from '@/components/ui'

export type Rule = { id?: string; keyword: string; matchType: 'CONTAINS' | 'EXACT' | 'STARTS_WITH'; isActive: boolean }
export type QuickReply = { title: string; payload?: string }

export type AutomationForm = {
  id?: string
  pageId: string
  type: 'COMMENT_REPLY' | 'WELCOME_MESSAGE' | 'DEFAULT_REPLY'
  name: string
  replyTemplate: string
  fallbackReply?: string | null
  matchMode: 'any' | 'keywords' | 'keywords+fallback'
  enabledPosts: string[]
  rules: Rule[]
  quickReplies?: QuickReply[] | null
  status: 'ACTIVE' | 'PAUSED'
}

export type PageOption = { id: string; name: string; status: string }

const DEFAULT_TEMPLATES: Record<AutomationForm['type'], string> = {
  COMMENT_REPLY: "Hi {{first_name}}! Thanks for your comment. Here's the information you requested: ",
  WELCOME_MESSAGE: 'Hello {{first_name}}! 👋 Welcome to our page. How can we help you today?',
  DEFAULT_REPLY: 'Hi {{first_name}}! Thanks for reaching out. Our team will be happy to assist you.',
}

export default function AutomationEditor({
  open,
  type,
  pages,
  automation,
  onClose,
  onSaved,
}: {
  open: boolean
  type: AutomationForm['type']
  pages: PageOption[]
  automation?: (Partial<AutomationForm> & { id: string }) | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<AutomationForm>(() => blankForm(type, pages[0]?.id ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posts, setPosts] = useState<{ id: string; label: string }[] | null>(null)
  const [postsReason, setPostsReason] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setPosts(null)
    setPostsReason(null)
    if (automation) {
      setForm({
        id: automation.id,
        pageId: automation.pageId ?? pages[0]?.id ?? '',
        type,
        name: automation.name ?? '',
        replyTemplate: automation.replyTemplate ?? DEFAULT_TEMPLATES[type],
        fallbackReply: automation.fallbackReply ?? '',
        matchMode: automation.matchMode ?? (type === 'DEFAULT_REPLY' ? 'keywords+fallback' : 'any'),
        enabledPosts: automation.enabledPosts ?? ['ALL'],
        rules: automation.rules ?? [],
        quickReplies: automation.quickReplies ?? (type === 'WELCOME_MESSAGE' ? [] : null),
        status: automation.status ?? 'PAUSED',
      })
    } else {
      setForm(blankForm(type, pages[0]?.id ?? ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, automation?.id])

  const connectedPages = useMemo(() => pages.filter((p) => p.status === 'CONNECTED'), [pages])

  useEffect(() => {
    if (!open || type !== 'COMMENT_REPLY' || !form.pageId) return
    let cancelled = false
    apiCall<{ posts: { id: string; label: string }[]; reason?: string }>(`/api/facebook/pages/${form.pageId}/posts`)
      .then((res) => {
        if (cancelled) return
        setPosts(res.posts)
        setPostsReason(res.reason ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setPosts([])
          setPostsReason('load_error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, type, form.pageId])

  if (!open) return null

  const selectedPage = connectedPages.find((p) => p.id === form.pageId)

  const preview = (form.replyTemplate || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, 'Sara')
    .replace(/\{\{\s*last_name\s*\}\}/gi, 'M.')
    .replace(/\{\{\s*full_name\s*\}\}/gi, 'Sara M.')
    .replace(/\{\{\s*page_name\s*\}\}/gi, selectedPage?.name || 'Your Page')

  const save = async (activate = false) => {
    setSaving(true)
    setError(null)
    try {
      const payload: AutomationForm = { ...form, status: activate ? 'ACTIVE' : form.status }
      if (form.id) {
        await apiCall(`/api/automations/${form.id}`, 'PATCH', payload)
      } else {
        await apiCall('/api/automations', 'POST', payload)
      }
      showToast(activate ? 'Automation saved and activated.' : 'Automation saved.', 'success')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const insertVar = (v: string) => {
    setForm((f) => ({ ...f, replyTemplate: `${f.replyTemplate}${v}` }))
  }

  const togglePost = (postId: string) => {
    setForm((f) => {
      const isAll = f.enabledPosts.includes('ALL')
      let next: string[]
      if (isAll) {
        next = [postId]
      } else {
        next = f.enabledPosts.includes(postId) ? f.enabledPosts.filter((x) => x !== postId) : [...f.enabledPosts, postId]
      }
      return { ...f, enabledPosts: next.length === 0 ? ['ALL'] : next }
    })
  }

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ background: 'rgba(15,10,35,0.5)' }} aria-modal="true" role="dialog">
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {form.id ? 'Edit' : 'New'} {type === 'COMMENT_REPLY' ? 'comment automation' : type === 'WELCOME_MESSAGE' ? 'welcome message' : 'default reply'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={saving} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            {connectedPages.length === 0 && (
              <div className="alert alert-warning py-2 small">
                You need at least one <strong>connected</strong> Facebook Page before configuring automations.
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-7">
                <label className="form-label" htmlFor="au-name">Automation name</label>
                <input
                  id="au-name"
                  className="form-control"
                  placeholder={type === 'COMMENT_REPLY' ? 'Price list auto-reply' : 'Welcome message'}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={120}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="au-page">Facebook Page</label>
                <select id="au-page" className="form-select" value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} disabled={Boolean(form.id)}>
                  {connectedPages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="form-label d-flex justify-content-between align-items-center" htmlFor="au-template">
                  <span>{type === 'DEFAULT_REPLY' ? 'Keyword reply message' : type === 'WELCOME_MESSAGE' ? 'Welcome message' : 'Private reply message'}</span>
                  <span className="d-inline-flex gap-1">
                    {['{{first_name}}', '{{last_name}}', '{{page_name}}'].map((v) => (
                      <button type="button" key={v} className="btn btn-sm btn-soft py-0" style={{ fontSize: '0.7rem' }} onClick={() => insertVar(v)}>
                        {v}
                      </button>
                    ))}
                  </span>
                </label>
                <textarea
                  id="au-template"
                  className="form-control"
                  rows={3}
                  maxLength={1900}
                  value={form.replyTemplate}
                  onChange={(e) => setForm({ ...form, replyTemplate: e.target.value })}
                />
                <div className="form-text">If a person&apos;s name is unavailable, {'{{first_name}}'} falls back to &quot;there&quot;.</div>
              </div>

              <div className="col-12">
                <div className="soft-panel p-3">
                  <div className="small fw-semibold text-secondary mb-1">PREVIEW</div>
                  <div className="chat-bubble chat-bubble-out" style={{ maxWidth: '100%' }}>{preview || '…'}</div>
                </div>
              </div>

              {type === 'COMMENT_REPLY' && (
                <>
                  <div className="col-12">
                    <label className="form-label">Trigger on</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input className="form-check-input" type="radio" name="matchMode" id="mm-any" checked={form.matchMode === 'any'} onChange={() => setForm({ ...form, matchMode: 'any' })} />
                        <label className="form-check-label" htmlFor="mm-any">Any comment</label>
                      </div>
                      <div className="form-check">
                        <input className="form-check-input" type="radio" name="matchMode" id="mm-kw" checked={form.matchMode === 'keywords'} onChange={() => setForm({ ...form, matchMode: 'keywords' })} />
                        <label className="form-check-label" htmlFor="mm-kw">Matching keywords only</label>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Eligible posts</label>
                    {form.enabledPosts[0] === 'ALL' ? (
                      <div className="soft-panel p-3 d-flex justify-content-between align-items-center">
                        <span className="small"><i className="bi bi-collection me-2 text-primary" />All posts on this Page (comments on any post trigger the reply)</span>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm({ ...form, enabledPosts: [] })}>Select specific posts</button>
                      </div>
                    ) : (
                      <div className="border rounded-3 p-3">
                        {posts === null ? (
                          <div className="small text-secondary"><span className="spinner-border spinner-border-sm me-2" />Loading posts…</div>
                        ) : posts.length === 0 ? (
                          <div className="small text-secondary">
                            {postsReason === 'meta_not_configured'
                              ? 'Post list requires Meta credentials — the automation will target all posts until configured.'
                              : postsReason
                                ? 'Could not load recent posts. You can still save; post targeting can be edited later.'
                                : 'No recent posts found on this Page.'}
                          </div>
                        ) : (
                          <div className="d-grid gap-2" style={{ maxHeight: 200, overflowY: 'auto' }}>
                            {posts.map((p) => (
                              <label key={p.id} className="form-check d-flex align-items-start gap-2 mb-0">
                                <input className="form-check-input mt-1" type="checkbox" checked={form.enabledPosts.includes(p.id)} onChange={() => togglePost(p.id)} />
                                <span className="small">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <button type="button" className="btn btn-sm btn-soft mt-2" onClick={() => setForm({ ...form, enabledPosts: ['ALL'] })}>
                          <i className="bi bi-arrow-counterclockwise me-1" />Back to all posts
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(type === 'COMMENT_REPLY' || type === 'DEFAULT_REPLY') && (form.matchMode !== 'any' || type === 'DEFAULT_REPLY') && (
                <div className="col-12">
                  <label className="form-label">Keywords</label>
                  <KeywordEditor rules={form.rules} onChange={(rules) => setForm({ ...form, rules })} />
                  {form.matchMode === 'keywords' && (
                    <div className="form-text">A comment must match at least one keyword (case-insensitive) to trigger the private reply.</div>
                  )}
                </div>
              )}

              {type === 'DEFAULT_REPLY' && (
                <div className="col-12">
                  <label className="form-label" htmlFor="au-fallback">Fallback message (when no keyword matches)</label>
                  <textarea
                    id="au-fallback"
                    className="form-control"
                    rows={2}
                    maxLength={1900}
                    placeholder="Hi {{first_name}}! Thanks for reaching out. Our team will be happy to assist you."
                    value={form.fallbackReply ?? ''}
                    onChange={(e) => setForm({ ...form, fallbackReply: e.target.value })}
                  />
                  <div className="form-text">Leave empty to stay silent when nothing matches.</div>
                </div>
              )}

              {type === 'WELCOME_MESSAGE' && (
                <div className="col-12">
                  <label className="form-label">Optional quick replies (up to 3)</label>
                  <QuickReplyEditor quickReplies={form.quickReplies ?? []} onChange={(qr) => setForm({ ...form, quickReplies: qr })} />
                  <div className="form-text">Shown where Meta supports quick replies; otherwise the plain welcome message is sent.</div>
                </div>
              )}

              <div className="col-12">
                <div className="small text-secondary">
                  <i className="bi bi-shield-check text-success me-1" />
                  Sends are policy-aware: eligibility (messaging windows, private-reply rules) is always checked at send time.
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer justify-content-between">
            <div>
              {form.id && (
                <span className="small text-secondary me-2">
                  Current status: <StatusBadge status={form.status} />
                </span>
              )}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-light border" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-outline-primary" onClick={() => save(false)} disabled={saving || connectedPages.length === 0}>
                {saving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-save me-1" />}
                Save
              </button>
              <button className="btn btn-primary" onClick={() => save(true)} disabled={saving || connectedPages.length === 0} title="Save and set status to Active">
                <i className="bi bi-play-circle me-1" />Save &amp; activate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function blankForm(type: AutomationForm['type'], pageId: string): AutomationForm {
  return {
    pageId,
    type,
    name: '',
    replyTemplate: DEFAULT_TEMPLATES[type],
    fallbackReply: '',
    matchMode: type === 'DEFAULT_REPLY' ? 'keywords+fallback' : 'any',
    enabledPosts: ['ALL'],
    rules: [],
    quickReplies: type === 'WELCOME_MESSAGE' ? [] : null,
    status: 'PAUSED',
  }
}

function KeywordEditor({ rules, onChange }: { rules: Rule[]; onChange: (r: Rule[]) => void }) {
  const [kw, setKw] = useState('')
  const [matchType, setMatchType] = useState<Rule['matchType']>('CONTAINS')

  const add = () => {
    const k = kw.trim()
    if (!k) return
    if (rules.some((r) => r.keyword.toLowerCase() === k.toLowerCase())) {
      showToast('That keyword is already in the list.', 'warning')
      return
    }
    onChange([...rules, { keyword: k, matchType, isActive: true }])
    setKw('')
  }

  return (
    <div>
      {rules.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {rules.map((r, i) => (
            <span key={`${r.keyword}-${i}`} className="badge badge-soft-primary d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
              “{r.keyword}”
              <span className="opacity-75">({r.matchType.toLowerCase().replace('_', ' ')})</span>
              <button
                type="button"
                className="btn btn-link p-0 text-danger"
                style={{ fontSize: '0.75rem' }}
                aria-label={`Remove keyword ${r.keyword}`}
                onClick={() => onChange(rules.filter((_, j) => j !== i))}
              >
                <i className="bi bi-x-lg" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="d-flex gap-2">
        <input
          className="form-control"
          style={{ maxWidth: 220 }}
          placeholder="e.g. price"
          value={kw}
          maxLength={80}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <select className="form-select" style={{ maxWidth: 150 }} value={matchType} onChange={(e) => setMatchType(e.target.value as Rule['matchType'])}>
          <option value="CONTAINS">Contains</option>
          <option value="EXACT">Exact match</option>
          <option value="STARTS_WITH">Starts with</option>
        </select>
        <button type="button" className="btn btn-outline-primary" onClick={add}>
          <i className="bi bi-plus-lg me-1" />Add
        </button>
      </div>
    </div>
  )
}

function QuickReplyEditor({ quickReplies, onChange }: { quickReplies: QuickReply[]; onChange: (q: QuickReply[]) => void }) {
  const [title, setTitle] = useState('')
  const add = () => {
    const t = title.trim()
    if (!t || quickReplies.length >= 3) return
    onChange([...quickReplies, { title: t, payload: t }])
    setTitle('')
  }
  return (
    <div>
      {quickReplies.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {quickReplies.map((q, i) => (
            <span key={`${q.title}-${i}`} className="badge badge-soft-info d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
              {q.title}
              <button type="button" className="btn btn-link p-0 text-danger" style={{ fontSize: '0.75rem' }} aria-label={`Remove ${q.title}`} onClick={() => onChange(quickReplies.filter((_, j) => j !== i))}>
                <i className="bi bi-x-lg" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="d-flex gap-2">
        <input className="form-control" style={{ maxWidth: 220 }} placeholder="e.g. See pricing" value={title} maxLength={20} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn btn-outline-primary" onClick={add} disabled={quickReplies.length >= 3}>
          <i className="bi bi-plus-lg me-1" />Add quick reply
        </button>
      </div>
    </div>
  )
}
