'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi, apiCall } from '@/hooks/useApi'
import { showToast } from '@/components/ui'

type Tag = { id: string; name: string; color: string; contactCount: number }

const VARIABLES = ['{{first_name}}', '{{last_name}}', '{{full_name}}', '{{page_name}}', '{{tracked_link}}']

export default function NewCampaignPage() {
  const router = useRouter()
  const tagsQ = useApi<{ tags: Tag[] }>('/api/contacts/tags')
  const [form, setForm] = useState({ name: '', body: '', trackedTargetUrl: '', scheduledAt: '' })
  const [tagIds, setTagIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<{ eligible: number; total: number; note?: string } | null>(null)
  const [previewName, setPreviewName] = useState('Sara')

  const preview = form.body
    .replace(/\{\{\s*first_name\s*\}\}/gi, previewName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, 'M.')
    .replace(/\{\{\s*full_name\s*\}\}/gi, `${previewName} M.`)
    .replace(/\{\{\s*page_name\s*\}\}/gi, 'Your Page')
    .replace(/\{\{\s*tracked_link\s*\}\}/gi, form.trackedTargetUrl ? 'https://dorlacode.com/l/abc123?c=…' : '{no tracked URL set}')

  const runEstimate = async () => {
    setBusy(true)
    setError(null)
    try {
      // Create the campaign as DRAFT first so the estimate endpoint can be used.
      const created = await apiCall<{ campaign: { id: string } }>('/api/campaigns', 'POST', {
        name: form.name || 'Untitled campaign',
        body: form.body || '…',
        trackedTargetUrl: form.trackedTargetUrl || '',
        audienceTagIds: [...tagIds],
        scheduledAt: null,
      })
      const est = await apiCall<{ eligible: number; total: number; note?: string }>(`/api/campaigns/${created.campaign.id}/estimate`, 'POST')
      setEstimate(est)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Estimate failed')
    } finally {
      setBusy(false)
    }
  }

  const launch = async (schedule = false) => {
    setError(null)
    if (!form.name.trim()) { setError('Campaign name is required.'); return }
    if (!form.body.trim()) { setError('Message content is required.'); return }
    setBusy(true)
    try {
      const created = await apiCall<{ campaign: { id: string; status: string } }>('/api/campaigns', 'POST', {
        name: form.name.trim(),
        body: form.body,
        trackedTargetUrl: form.trackedTargetUrl || '',
        audienceTagIds: [...tagIds],
        scheduledAt: schedule && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      })
      if (schedule && form.scheduledAt) {
        showToast(`Campaign scheduled for ${new Date(form.scheduledAt).toLocaleString()}.`, 'success')
        router.push(`/dashboard/campaigns/${created.campaign.id}`)
        return
      }
      // Launch immediately: re-check eligibility and queue delivery.
      const est = await apiCall<{ eligible: number; total: number }>(`/api/campaigns/${created.campaign.id}/estimate`, 'POST')
      if (est.eligible === 0) {
        setError('No recipients are currently eligible (open 24h messaging window required). The campaign was saved as a draft — launch it later from its detail page.')
        setEstimate(est)
        setBusy(false)
        return
      }
      const launched = await apiCall<{ queued: number; skipped: number }>(`/api/campaigns/${created.campaign.id}/launch`, 'POST')
      showToast(`Campaign launched: ${launched.queued} recipient job(s) queued.`, 'success')
      router.push(`/dashboard/campaigns/${created.campaign.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed')
      setBusy(false)
    }
  }

  const insertVar = (v: string) => setForm((f) => ({ ...f, body: `${f.body}${v}` }))

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-4">
        <Link href="/dashboard/campaigns" className="btn btn-light border btn-sm"><i className="bi bi-arrow-left" /></Link>
        <div>
          <h1 className="h4 fw-bold mb-0">New broadcast campaign</h1>
          <p className="text-secondary small mb-0">Sends go only to contacts with an open messaging window. Opted-out contacts are always excluded.</p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body p-4">
              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              <div className="mb-3">
                <label className="form-label" htmlFor="cm-name">Campaign name</label>
                <input id="cm-name" className="form-control" maxLength={120} placeholder="October update" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label d-flex justify-content-between" htmlFor="cm-body">
                  <span>Message</span>
                  <span className="d-inline-flex gap-1 flex-wrap">
                    {VARIABLES.map((v) => (
                      <button type="button" key={v} className="btn btn-sm btn-soft py-0" style={{ fontSize: '0.68rem' }} onClick={() => insertVar(v)}>{v}</button>
                    ))}
                  </span>
                </label>
                <textarea id="cm-body" className="form-control" rows={5} maxLength={1900} placeholder="Hi {{first_name}}, we have an update for you. Tap here to learn more: {{tracked_link}}" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                <div className="form-text">{form.body.length}/1900 characters · Messenger text limit is 2000.</div>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="cm-url">Tracked link destination (optional)</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-link-45deg" /></span>
                  <input id="cm-url" type="url" className="form-control" placeholder="https://your-site.com/landing-page" value={form.trackedTargetUrl} onChange={(e) => setForm({ ...form, trackedTargetUrl: e.target.value })} />
                </div>
                <div className="form-text">Every recipient gets a unique tracked link; clicks are attributed and deduplicated in Analytics.</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Audience segment</label>
                <div className="d-flex flex-wrap gap-2">
                  {(tagsQ.data?.tags ?? []).map((t) => {
                    const active = tagIds.has(t.id)
                    return (
                      <button type="button" key={t.id} className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`} style={{ fontSize: '0.78rem' }} onClick={() => { const n = new Set(tagIds); if (active) n.delete(t.id); else n.add(t.id); setTagIds(n) }}>
                        {t.name} <span className="opacity-75">({t.contactCount})</span>
                      </button>
                    )
                  })}
                </div>
                <div className="form-text">{(tagsQ.data?.tags ?? []).length === 0 ? 'No tags yet — the campaign will target all contacts with messaging eligibility.' : 'No tags selected = all eligible contacts.'}</div>
              </div>
              <div className="mb-4">
                <label className="form-label" htmlFor="cm-when">Schedule (optional)</label>
                <input id="cm-when" type="datetime-local" className="form-control" style={{ maxWidth: 280 }} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                <div className="form-text">Scheduled campaigns are dispatched automatically by the background worker when due.</div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-outline-primary" onClick={runEstimate} disabled={busy}>
                  {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-people me-1" />}
                  Estimate audience
                </button>
                <button className="btn btn-primary" onClick={() => launch(false)} disabled={busy || !form.body.trim()}>
                  <i className="bi bi-send me-1" />Launch now
                </button>
                <button className="btn btn-outline-primary" onClick={() => launch(true)} disabled={busy || !form.body.trim() || !form.scheduledAt}>
                  <i className="bi bi-clock me-1" />Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header">Audience estimate</div>
            <div className="card-body">
              {estimate ? (
                <div>
                  <div className="d-flex align-items-baseline gap-2 mb-2">
                    <span className="fs-2 fw-bold text-primary">{estimate.eligible.toLocaleString()}</span>
                    <span className="text-secondary">eligible of {estimate.total.toLocaleString()} contacts</span>
                  </div>
                  {estimate.note && <div className="alert alert-warning py-2 small mb-0">{estimate.note}</div>}
                  <p className="small text-secondary mb-0 mt-2">
                    Eligibility = open 24h messaging window + not opted out/blocked. Re-checked per recipient at send time.
                  </p>
                </div>
              ) : (
                <p className="small text-secondary mb-0">Click <strong>Estimate audience</strong> to see how many contacts can legally receive this campaign right now.</p>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header">Preview</div>
            <div className="card-body">
              <div className="phone-mock" style={{ maxWidth: 300 }}>
                <div className="p-3 d-grid gap-2" style={{ minHeight: 120 }}>
                  <div className="chat-bubble chat-bubble-out" style={{ maxWidth: '100%' }}>{preview || '…'}</div>
                </div>
              </div>
              <input className="form-control form-control-sm mt-3" style={{ maxWidth: 160 }} value={previewName} onChange={(e) => setPreviewName(e.target.value)} aria-label="Preview name" />
              <div className="form-text">Edit the name to test personalization.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
