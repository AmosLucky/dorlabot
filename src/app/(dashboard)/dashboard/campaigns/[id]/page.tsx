'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, StatusBadge, ConfirmDialog, CopyButton, showToast } from '@/components/ui'
import { usePathname } from 'next/navigation'

type CampaignDetail = {
  id: string
  name: string
  body: string
  status: string
  trackedTargetUrl?: string | null
  eligibleCount: number
  totalRecipients: number
  sentCount: number
  failedCount: number
  skippedCount: number
  scheduledAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  lastError?: string | null
  isSample: boolean
  createdAt: string
  audienceSegment: { tagIds?: string[] }
}

type Recipient = {
  id: string
  status: string
  error?: string | null
  skipReason?: string | null
  sentAt?: string | null
  contact: { id: string; name?: string | null; messagingState: string }
}

type TrackedLink = { id: string; slug: string; targetUrl: string; clickCount: number; uniqueClickCount: number }

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const pathname = usePathname()
  const { data, loading, error, refetch } = useApi<{ campaign: CampaignDetail; recipients: Recipient[]; trackedLink: TrackedLink | null }>(`/api/campaigns/${id}`)
  const [confirmLaunch, setConfirmLaunch] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const c = data!.campaign
  const appBase = typeof window !== 'undefined' ? window.location.origin : ''

  const launch = async () => {
    setBusy(true)
    try {
      const res = await apiCall<{ queued: number }>(`/api/campaigns/${id}/launch`, 'POST')
      showToast(`Launched: ${res.queued} recipient job(s) queued.`, 'success')
      setConfirmLaunch(false)
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Launch failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      await apiCall(`/api/campaigns/${id}/cancel`, 'POST')
      showToast('Campaign cancelled.', 'success')
      setConfirmCancel(false)
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cancel failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const statusCounts = data!.recipients.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div className="d-flex align-items-center gap-3">
          <Link href="/dashboard/campaigns" className="btn btn-light border btn-sm"><i className="bi bi-arrow-left" /></Link>
          <div>
            <h1 className="h4 fw-bold mb-1">
              {c.name} {c.isSample && <span className="badge badge-soft-warning">SAMPLE</span>}
            </h1>
            <div className="d-flex gap-2 align-items-center">
              <StatusBadge status={c.status} />
              <span className="small text-secondary">Created {new Date(c.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="d-flex gap-2">
          {['DRAFT', 'SCHEDULED'].includes(c.status) && (
            <button className="btn btn-primary" onClick={() => setConfirmLaunch(true)} disabled={busy}>
              <i className="bi bi-send me-1" />Launch campaign
            </button>
          )}
          {['SCHEDULED', 'SENDING', 'LAUNCHING'].includes(c.status) && (
            <button className="btn btn-outline-danger" onClick={() => setConfirmCancel(true)} disabled={busy}>
              <i className="bi bi-stop-circle me-1" />Cancel
            </button>
          )}
        </div>
      </div>

      {c.lastError && <div className="alert alert-danger py-2 small">{c.lastError}</div>}

      <div className="row g-3 mb-3">
        {[
          { label: 'Eligible (estimate)', value: c.eligibleCount },
          { label: 'Total recipients', value: c.totalRecipients },
          { label: 'Sent', value: c.sentCount },
          { label: 'Failed', value: c.failedCount },
          { label: 'Skipped', value: c.skippedCount },
        ].map((s) => (
          <div className="col-6 col-md-4 col-xl-2" key={s.label}>
            <div className="card stat-card h-100">
              <div className="card-body">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
        {data!.trackedLink && (
          <div className="col-md-6 col-xl-2">
            <div className="card stat-card h-100">
              <div className="card-body">
                <div className="stat-label">Link clicks</div>
                <div className="stat-value">{data!.trackedLink.clickCount.toLocaleString()}</div>
                <div className="small text-secondary">{data!.trackedLink.uniqueClickCount} unique</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {data!.trackedLink && (
        <div className="card mb-3">
          <div className="card-body d-flex flex-wrap align-items-center gap-3">
            <div className="flex-grow-1">
              <div className="fw-semibold small">Tracked link</div>
              <div className="small text-secondary text-break">/{`l/${data!.trackedLink.slug}`} → {data!.trackedLink.targetUrl}</div>
            </div>
            <CopyButton text={`${appBase}/l/${data!.trackedLink.slug}`} label="Copy link" />
            <Link href={`${pathname.replace(/\/$/, '')}`} className="btn btn-sm btn-outline-primary">Clicks in analytics →</Link>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">Message</div>
            <div className="card-body">
              <div className="chat-bubble chat-bubble-in" style={{ maxWidth: '100%', whiteSpace: 'pre-wrap' }}>{c.body}</div>
              {c.trackedTargetUrl && <div className="small text-secondary mt-2"><i className="bi bi-link-45deg me-1" />Tracked destination: {c.trackedTargetUrl}</div>}
              {c.scheduledAt && c.status === 'SCHEDULED' && <div className="small text-secondary mt-2"><i className="bi bi-clock me-1" />Scheduled for {new Date(c.scheduledAt).toLocaleString()}</div>}
              {c.startedAt && <div className="small text-secondary mt-2"><i className="bi bi-play me-1" />Started {new Date(c.startedAt).toLocaleString()}</div>}
              {c.completedAt && <div className="small text-secondary mt-1"><i className="bi bi-check2 me-1" />Completed {new Date(c.completedAt).toLocaleString()}</div>}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between">
              <span>Recipients</span>
              <span className="small text-secondary">{Object.entries(statusCounts).map(([k, v]) => `${k.toLowerCase()}: ${v}`).join(' · ') || '—'}</span>
            </div>
            <div className="card-body p-0" style={{ maxHeight: 480, overflowY: 'auto' }}>
              {data!.recipients.length === 0 ? (
                <div className="text-center text-secondary py-5 small">
                  Recipients are created when the campaign is launched.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th className="ps-3">Contact</th>
                        <th>Status</th>
                        <th>Detail</th>
                        <th className="pe-3">Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.recipients.map((r) => (
                        <tr key={r.id}>
                          <td className="ps-3">
                            <Link href={`/dashboard/contacts/${r.contact.id}`} className="small fw-semibold">
                              {r.contact.name || 'Unnamed'}
                            </Link>
                          </td>
                          <td><StatusBadge status={r.status} /></td>
                          <td className="small text-secondary">{r.skipReason || r.error || '—'}</td>
                          <td className="small text-secondary pe-3">{r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLaunch}
        title="Launch campaign"
        message={`Launch "${c.name}"? Eligibility is re-checked per recipient and delivery is queued through the background worker with rate limiting.`}
        confirmLabel="Launch now"
        danger={false}
        busy={busy}
        onConfirm={launch}
        onCancel={() => setConfirmLaunch(false)}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel campaign"
        message="Cancel this campaign? Queued recipients will be marked cancelled and no longer sent."
        confirmLabel="Cancel campaign"
        busy={busy}
        onConfirm={cancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  )
}
