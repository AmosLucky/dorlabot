'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ErrorState, EmptyState, StatusBadge, ConfirmDialog, showToast } from '@/components/ui'
import MetaSetupNotice from '@/components/MetaSetupNotice'

type CampaignRow = {
  id: string
  name: string
  status: string
  totalRecipients: number
  eligibleCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  scheduledAt?: string | null
  completedAt?: string | null
  createdAt: string
  isSample: boolean
}

function CampaignsInner() {
  const { data, loading, error, refetch } = useApi<{ campaigns: CampaignRow[] }>('/api/campaigns')
  const [confirmCancel, setConfirmCancel] = useState<CampaignRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CampaignRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const campaigns = data?.campaigns ?? []

  const cancel = async () => {
    if (!confirmCancel) return
    setBusyId(confirmCancel.id)
    try {
      await apiCall(`/api/campaigns/${confirmCancel.id}/cancel`, 'POST')
      showToast('Campaign cancelled. Pending sends were stopped.', 'success')
      setConfirmCancel(null)
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cancel failed', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return
    setBusyId(confirmDelete.id)
    try {
      await apiCall(`/api/campaigns/${confirmDelete.id}`, 'DELETE')
      showToast('Campaign deleted.', 'success')
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
          <h1 className="h4 fw-bold mb-1">Campaigns</h1>
          <p className="text-secondary small mb-0">Policy-aware Messenger broadcasts — audience estimates before launch, queue-based delivery, honest status.</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-1" />New campaign
        </Link>
      </div>

      <MetaSetupNotice />

      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon="bi-megaphone"
              title="No campaigns yet"
              description="Create a broadcast campaign to reach contacts with an open messaging window. The platform estimates the eligible audience before you launch and re-checks every recipient at send time."
              action={<Link href="/dashboard/campaigns/new" className="btn btn-primary">Create your first campaign</Link>}
            />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="ps-3">Campaign</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Created</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="ps-3">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="fw-semibold">
                          {c.name} {c.isSample && <span className="badge badge-soft-warning">SAMPLE</span>}
                        </Link>
                        {c.scheduledAt && c.status === 'SCHEDULED' && (
                          <div className="small text-secondary">Scheduled {new Date(c.scheduledAt).toLocaleString()}</div>
                        )}
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                      <td style={{ minWidth: 160 }}>
                        {c.totalRecipients > 0 ? (
                          <>
                            <div className="progress" style={{ height: 6 }}>
                              <div className="progress-bar bg-success" style={{ width: `${(c.sentCount / c.totalRecipients) * 100}%` }} />
                              <div className="progress-bar bg-danger" style={{ width: `${(c.failedCount / c.totalRecipients) * 100}%` }} />
                            </div>
                            <div className="small text-secondary mt-1">
                              {c.sentCount}/{c.totalRecipients} sent
                              {c.skippedCount > 0 && ` · ${c.skippedCount} skipped`}
                              {c.failedCount > 0 && ` · ${c.failedCount} failed`}
                            </div>
                          </>
                        ) : (
                          <span className="small text-secondary">{c.eligibleCount} eligible (estimate)</span>
                        )}
                      </td>
                      <td className="small text-secondary">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="text-end pe-3">
                        <div className="btn-group btn-group-sm">
                          {['SCHEDULED', 'SENDING', 'LAUNCHING', 'DRAFT'].includes(c.status) && (
                            <button className="btn btn-outline-secondary" onClick={() => setConfirmCancel(c)} disabled={busyId === c.id} title="Cancel">
                              <i className="bi bi-stop-circle" />
                            </button>
                          )}
                          {!['SENDING', 'LAUNCHING'].includes(c.status) && (
                            <button className="btn btn-outline-danger" onClick={() => setConfirmDelete(c)} disabled={busyId === c.id} title="Delete">
                              <i className="bi bi-trash" />
                            </button>
                          )}
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

      <ConfirmDialog open={confirmCancel !== null} title="Cancel campaign" message={`Cancel "${confirmCancel?.name}"? Recipients still queued will be marked cancelled and no longer sent.`} confirmLabel="Cancel campaign" busy={busyId !== null} onConfirm={cancel} onCancel={() => setConfirmCancel(null)} />
      <ConfirmDialog open={confirmDelete !== null} title="Delete campaign" message={`Delete "${confirmDelete?.name}"? Delivery history for this campaign will be removed.`} confirmLabel="Delete" busy={busyId !== null} onConfirm={remove} onCancel={() => setConfirmDelete(null)} />
    </div>
  )
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CampaignsInner />
    </Suspense>
  )
}
