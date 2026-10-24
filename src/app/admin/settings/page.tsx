'use client'

import { useState } from 'react'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, showToast } from '@/components/ui'

type Settings = {
  privateReplyWindowDays: number
  messagingWindowHours: number
  campaignRatePerMinute: number
  maxPrivateRepliesPerComment: number
  requireWindowForCampaigns: boolean
  registrationEnabled: boolean
  supportEmail: string
}

const FIELDS: { key: keyof Settings; label: string; help: string; type: 'number' | 'boolean' | 'text' }[] = [
  { key: 'privateReplyWindowDays', label: 'Private reply window (days)', help: 'How long after a comment a private reply is permitted (Meta policy default: 7).', type: 'number' },
  { key: 'messagingWindowHours', label: 'Standard messaging window (hours)', help: 'Window opened by an inbound message (Meta standard: 24).', type: 'number' },
  { key: 'campaignRatePerMinute', label: 'Campaign rate (sends/minute)', help: 'Throughput limit applied by the delivery queue.', type: 'number' },
  { key: 'maxPrivateRepliesPerComment', label: 'Max private replies per comment', help: 'Hard idempotency cap; Meta allows one.', type: 'number' },
  { key: 'requireWindowForCampaigns', label: 'Require open window for campaigns', help: 'When enabled, campaigns only target contacts with an open messaging window.', type: 'boolean' },
  { key: 'registrationEnabled', label: 'Enable public registration', help: 'Allow new customers to create accounts.', type: 'boolean' },
  { key: 'supportEmail', label: 'Support email', help: 'Shown on the Help page and contact guidance.', type: 'text' },
]

export default function AdminSettingsPage() {
  const { data, loading, error, refetch } = useApi<{ settings: Settings }>('/api/admin/settings')
  const [form, setForm] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <div className="alert alert-danger">{error}</div>
  const settings = form ?? data!.settings

  const save = async () => {
    setBusy(true)
    try {
      const payload = {
        settings: FIELDS.map((f) => ({ key: f.key, value: settings[f.key] as string | number | boolean })),
      }
      await apiCall('/api/admin/settings', 'PUT', payload)
      showToast('Platform settings saved.', 'success')
      refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">Platform settings</h1>
        <p className="text-secondary small mb-0">
          Configurable business rules informed by current Meta documentation. Changing these affects eligibility behavior platform-wide.
        </p>
      </div>

      <div className="card">
        <div className="card-body p-4 d-grid gap-3">
          {FIELDS.map((f) => (
            <div className="row align-items-center" key={f.key}>
              <div className="col-md-6">
                <label className="fw-semibold small" htmlFor={`set-${f.key}`}>{f.label}</label>
                <div className="text-secondary" style={{ fontSize: '0.78rem' }}>{f.help}</div>
              </div>
              <div className="col-md-6 mt-2 mt-md-0">
                {f.type === 'boolean' ? (
                  <div className="form-check form-switch">
                    <input
                      id={`set-${f.key}`}
                      className="form-check-input"
                      type="checkbox"
                      checked={Boolean(settings[f.key])}
                      onChange={(e) => setForm({ ...settings, [f.key]: e.target.checked })}
                    />
                  </div>
                ) : f.type === 'number' ? (
                  <input
                    id={`set-${f.key}`}
                    type="number"
                    className="form-control"
                    style={{ maxWidth: 140 }}
                    value={Number(settings[f.key])}
                    min={f.key === 'privateReplyWindowDays' ? 1 : 1}
                    max={f.key === 'messagingWindowHours' ? 168 : 365}
                    onChange={(e) => setForm({ ...settings, [f.key]: Number(e.target.value) })}
                  />
                ) : (
                  <input
                    id={`set-${f.key}`}
                    type="text"
                    className="form-control"
                    value={String(settings[f.key])}
                    maxLength={120}
                    onChange={(e) => setForm({ ...settings, [f.key]: e.target.value })}
                  />
                )}
              </div>
            </div>
          ))}
          <hr />
          <div>
            <button className="btn btn-primary" onClick={save} disabled={busy || form === null}>
              {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-save me-1" />}
              Save settings
            </button>
            {form !== null && (
              <button className="btn btn-light border ms-2" onClick={() => setForm(null)} disabled={busy}>Reset changes</button>
            )}
          </div>
        </div>
      </div>

      <div className="alert alert-info small mt-3">
        <i className="bi bi-shield-check me-1" />
        Meta compliance note: these settings let operators adapt to policy updates without code changes, but they never enable
        policy bypass — private replies remain one-per-comment, opt-outs are always honored, and unsupported messaging is skipped.
      </div>
    </div>
  )
}
