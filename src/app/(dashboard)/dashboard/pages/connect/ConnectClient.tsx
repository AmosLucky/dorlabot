'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiCall } from '@/hooks/useApi'
import { Loading, showToast } from '@/components/ui'

type SelectionPayload = { pages: { id: string; name: string; category?: string | null }[] }

function ConnectInner() {
  const params = useSearchParams()
  const router = useRouter()
  const selectionId = params.get('selection') || ''
  const [payload, setPayload] = useState<SelectionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const missingSelection = !selectionId

  useEffect(() => {
    if (missingSelection) return
    let cancelled = false
    apiCall<SelectionPayload>(`/api/facebook/selection/${selectionId}`, 'GET')
      .then((res) => {
        if (cancelled) return
        setPayload(res)
        setSelected(new Set(res.pages.map((p) => p.id)))
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectionId, missingSelection])

  const connect = async () => {
    if (selected.size === 0) return
    setBusy(true)
    try {
      const res = await apiCall<{ results: { connected: boolean; error?: string }[] }>('/api/facebook/pages', 'POST', {
        selectionId,
        pageIds: [...selected],
      })
      const ok = res.results.filter((r) => r.connected).length
      const failed = res.results.filter((r) => !r.connected)
      if (ok > 0) showToast(`${ok} page(s) connected.`, 'success')
      if (failed.length > 0) showToast(`Some pages failed: ${failed[0].error ?? 'unknown error'}`, 'danger')
      router.push('/dashboard/pages')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Connection failed', 'danger')
      setBusy(false)
    }
  }

  if (loading && !missingSelection) return <Loading label="Loading your Facebook Pages…" />
  if (missingSelection || error || !payload) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <i className="bi bi-exclamation-circle text-warning fs-1" />
          <h5 className="mt-3">{missingSelection ? 'Missing selection reference. Start the connection again.' : error || 'Selection not found'}</h5>
          <p className="text-secondary small">Selections expire 15 minutes after the Facebook login for security.</p>
          <a href="/api/facebook/connect" className="btn btn-primary mt-2">Try connecting again</a>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-body p-4">
        <h1 className="h5 fw-bold">Select the Pages to connect</h1>
        <p className="text-secondary small">
          These are the Pages your Facebook account manages. Choose which ones DorlaCode may configure. Access tokens are
          encrypted and stored server-side immediately — they never pass back through the browser.
        </p>
        <div className="d-grid gap-2 my-3">
          {payload.pages.map((p) => (
            <label
              key={p.id}
              className="border rounded-3 p-3 d-flex align-items-center gap-3 pointer"
              style={{ borderColor: selected.has(p.id) ? 'var(--fc-primary)' : undefined, borderWidth: selected.has(p.id) ? 2 : 1 }}
            >
              <input
                type="checkbox"
                className="form-check-input m-0"
                checked={selected.has(p.id)}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(p.id)
                  else next.delete(p.id)
                  setSelected(next)
                }}
              />
              <span className="avatar-initials" style={{ background: '#e8f0fe', color: '#1967d2' }}>
                <i className="bi bi-flag" />
              </span>
              <span>
                <span className="fw-semibold d-block">{p.name}</span>
                <span className="small text-secondary">{p.category || 'Facebook Page'} · ID {p.id}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={connect} disabled={busy || selected.size === 0}>
            {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-link-45deg me-1" />}
            Connect {selected.size > 0 ? `${selected.size} page(s)` : ''}
          </button>
          <button className="btn btn-light border" onClick={() => router.push('/dashboard/pages')} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConnectClient() {
  return (
    <Suspense fallback={<Loading />}>
      <ConnectInner />
    </Suspense>
  )
}
