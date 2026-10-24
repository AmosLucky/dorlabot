'use client'

import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, StatusBadge, ConfirmDialog, showToast } from '@/components/ui'
import { useState } from 'react'

type FailedJob = {
  id: string
  queue: string
  jobId: string
  jobName: string
  attempts: number
  error?: string | null
  status: string
  firstFailedAt: string
  lastFailedAt: string
  resolvedAt?: string | null
}
type WebhookEvent = {
  id: string
  field?: string | null
  objectType: string
  fbPageId?: string | null
  status: string
  signatureVerified: boolean
  processAttempts: number
  lastError?: string | null
  receivedAt: string
  processedAt?: string | null
}

export default function AdminMonitoringPage() {
  const { data, loading, error, refetch } = useApi<{ failedJobs: FailedJob[]; recentEvents: WebhookEvent[]; eventStats: Record<string, number>; redisConfigured: boolean }>('/api/admin/jobs')
  const [confirmResolve, setConfirmResolve] = useState<FailedJob | null>(null)
  const [busy, setBusy] = useState(false)

  const jobs = data?.failedJobs ?? []
  const events = data?.recentEvents ?? []
  const stats = data?.eventStats ?? {}
  const openJobs = jobs.filter((j) => j.status !== 'RESOLVED')

  const resolve = async () => {
    if (!confirmResolve) return
    setBusy(true)
    try {
      await apiCall('/api/admin/jobs', 'POST', { jobId: confirmResolve.id, action: 'resolve' })
      showToast('Job marked as resolved.', 'success')
      setConfirmResolve(null)
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const retry = async (job: FailedJob) => {
    setBusy(true)
    try {
      const res = await apiCall<{ enqueued?: boolean; note?: string }>('/api/admin/jobs', 'POST', { jobId: job.id, action: 'retry' })
      showToast(res.note ?? 'Job reset for reprocessing.', 'success')
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Retry failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">System monitoring</h1>
        <p className="text-secondary small mb-0">Queue health, webhook processing, and failed jobs.</p>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2">
          <div className="card stat-card"><div className="card-body py-3">
            <div className="stat-label">Redis / queue</div>
            <div className={`fw-bold ${data?.redisConfigured ? 'text-success' : 'text-danger'}`}>{data?.redisConfigured ? 'CONFIGURED' : 'NOT SET'}</div>
          </div></div>
        </div>
        {['PENDING', 'PROCESSING', 'PROCESSED', 'SKIPPED', 'FAILED'].map((s) => (
          <div className="col-6 col-md-2" key={s}>
            <div className="card stat-card"><div className="card-body py-3">
              <div className="stat-label">Events {s.toLowerCase()}</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>{(stats[s] ?? 0).toLocaleString()}</div>
            </div></div>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Failed background jobs</span>
          <span className="badge badge-soft-danger">{openJobs.length} open</span>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : jobs.length === 0 ? (
            <div className="text-center text-secondary py-5 small">No failed jobs recorded. 🎉</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Queue / job</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Error</th>
                    <th>Last failed</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="ps-3 small">
                        <div className="fw-semibold">{j.queue}</div>
                        <div className="text-secondary">{j.jobName} · {j.jobId.slice(0, 12)}…</div>
                      </td>
                      <td><StatusBadge status={j.status} /></td>
                      <td>{j.attempts}</td>
                      <td className="small text-danger text-truncate" style={{ maxWidth: 300 }}>{j.error ?? '—'}</td>
                      <td className="small text-secondary">{new Date(j.lastFailedAt).toLocaleString()}</td>
                      <td className="text-end pe-3">
                        {j.status !== 'RESOLVED' && (
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" onClick={() => retry(j)} disabled={busy} title="Reset & reprocess">
                              <i className="bi bi-arrow-clockwise" />
                            </button>
                            <button className="btn btn-outline-secondary" onClick={() => setConfirmResolve(j)} disabled={busy} title="Mark resolved">
                              <i className="bi bi-check2" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Recent webhook events</div>
        <div className="card-body p-0" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th className="ps-3">Field</th>
                  <th>Page</th>
                  <th>Status</th>
                  <th>Sig verified</th>
                  <th>Attempts</th>
                  <th>Received</th>
                  <th className="pe-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-secondary small py-4">No webhook events received yet.</td></tr>
                )}
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="ps-3 small">{e.field ?? e.objectType}</td>
                    <td className="small text-secondary">{e.fbPageId ?? '—'}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="small">{e.signatureVerified ? <i className="bi bi-shield-check text-success" /> : <i className="bi bi-shield-exclamation text-warning" />}</td>
                    <td className="small">{e.processAttempts}</td>
                    <td className="small text-secondary">{new Date(e.receivedAt).toLocaleString()}</td>
                    <td className="small text-danger text-truncate pe-3" style={{ maxWidth: 220 }}>{e.lastError ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog open={confirmResolve !== null} title="Mark job resolved" message="Mark this failed job as resolved without reprocessing it?" confirmLabel="Mark resolved" danger={false} busy={busy} onConfirm={resolve} onCancel={() => setConfirmResolve(null)} />
    </div>
  )
}
