'use client'

import { useState, useEffect } from 'react'
import { useApi, apiCall } from '@/hooks/useApi'
import { Loading, ConfirmDialog, showToast, CopyButton } from '@/components/ui'

type Me = { id: string; name: string; email: string; role: string; twoFactorEnabled: boolean; notificationPrefs?: Record<string, boolean> | null }
type SessionRow = { id: string; ip?: string | null; userAgent?: string | null; createdAt: string; expiresAt: string; current: boolean }

export default function SettingsPage() {
  const meQ = useApi<Me>('/api/auth/me')
  const sessionsQ = useApi<{ sessions: SessionRow[] }>('/api/auth/sessions')
  const [tab, setTab] = useState<'profile' | 'security' | 'notifications'>('profile')

  const [name, setName] = useState('')
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [twoFa, setTwoFa] = useState<{ qrDataUrl: string; otpauth: string } | null>(null)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [disablePw, setDisablePw] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)

  useEffect(() => {
    if (meQ.data?.user) setName(meQ.data.user.name)
  }, [meQ.data])

  const me = meQ.data?.user

  const saveProfile = async () => {
    setBusy(true)
    try {
      await apiCall('/api/profile', 'PATCH', { name })
      showToast('Profile updated.', 'success')
      meQ.refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirm) {
      showToast('New passwords do not match.', 'danger')
      return
    }
    setBusy(true)
    try {
      await apiCall('/api/profile/password', 'POST', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      showToast('Password updated. Other sessions were signed out.', 'success')
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Password change failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const startTwoFa = async () => {
    setBusy(true)
    try {
      const res = await apiCall<{ qrDataUrl: string; otpauth: string }>('/api/auth/2fa/setup', 'POST')
      setTwoFa(res)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Setup failed', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const confirmTwoFa = async () => {
    setBusy(true)
    try {
      await apiCall('/api/auth/2fa/enable', 'POST', { code: twoFaCode })
      showToast('Two-factor authentication enabled.', 'success')
      setTwoFa(null)
      setTwoFaCode('')
      meQ.refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid code', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const disableTwoFa = async () => {
    setBusy(true)
    try {
      await apiCall('/api/auth/2fa/disable', 'POST', { password: disablePw })
      showToast('Two-factor authentication disabled.', 'success')
      setDisablePw('')
      meQ.refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to disable', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const setPref = async (key: string, value: boolean) => {
    try {
      await apiCall('/api/profile', 'PATCH', { notificationPrefs: { [key]: value } })
      meQ.refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'danger')
    }
  }

  if (meQ.loading) return <Loading />
  if (meQ.error) return <div className="alert alert-danger">{meQ.error}</div>

  const prefs = me?.notificationPrefs ?? {}

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="mb-4">
        <h1 className="h4 fw-bold mb-1">Settings</h1>
        <p className="text-secondary small mb-0">Manage your profile, security, and notification preferences.</p>
      </div>

      <ul className="nav nav-pills gap-2 mb-4">
        {([['profile', 'Profile', 'bi-person'], ['security', 'Security', 'bi-shield-lock'], ['notifications', 'Notifications', 'bi-bell']] as const).map(([key, label, icon]) => (
          <li className="nav-item" key={key}>
            <button className={`nav-link ${tab === key ? 'active' : 'text-secondary'}`} onClick={() => setTab(key)}>
              <i className={`bi ${icon} me-1`} />{label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'profile' && (
        <div className="card">
          <div className="card-body p-4">
            <div className="mb-3">
              <label className="form-label" htmlFor="st-name">Full name</label>
              <input id="st-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input className="form-control" value={me?.email ?? ''} disabled />
              <div className="form-text">Contact support to change your sign-in email.</div>
            </div>
            <button className="btn btn-primary" onClick={saveProfile} disabled={busy || name === me?.name}>
              <i className="bi bi-save me-1" />Save changes
            </button>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="d-grid gap-3">
          <div className="card">
            <div className="card-header">Change password</div>
            <div className="card-body p-4 d-grid gap-3">
              <div>
                <label className="form-label" htmlFor="st-cur">Current password</label>
                <input id="st-cur" type="password" className="form-control" autoComplete="current-password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="st-new">New password</label>
                  <input id="st-new" type="password" className="form-control" autoComplete="new-password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="st-conf">Confirm new password</label>
                  <input id="st-conf" type="password" className="form-control" autoComplete="new-password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={changePassword} disabled={busy || !pwForm.currentPassword || !pwForm.newPassword}>
                <i className="bi bi-key me-1" />Update password
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Two-factor authentication (TOTP)</span>
              <span className={`badge ${me?.twoFactorEnabled ? 'badge-soft-success' : 'badge-soft-secondary'}`}>
                {me?.twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <div className="card-body p-4">
              {!me?.twoFactorEnabled && !twoFa && (
                <>
                  <p className="small text-secondary mb-3">Add a second factor using any TOTP authenticator app (Google Authenticator, Authy, 1Password…).</p>
                  <button className="btn btn-primary" onClick={startTwoFa} disabled={busy}>
                    <i className="bi bi-shield-plus me-1" />Set up 2FA
                  </button>
                </>
              )}
              {twoFa && (
                <div className="row g-3 align-items-center">
                  <div className="col-md-4 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={twoFa.qrDataUrl} alt="Two-factor QR code" className="img-fluid border rounded-3" style={{ maxWidth: 180 }} />
                  </div>
                  <div className="col-md-8">
                    <p className="small text-secondary">Scan the QR code with your authenticator app, or paste this key:</p>
                    <div className="d-flex gap-2 align-items-center mb-3">
                      <code className="small text-break">{twoFa.otpauth}</code>
                      <CopyButton text={twoFa.otpauth} />
                    </div>
                    <div className="d-flex gap-2">
                      <input className="form-control" style={{ maxWidth: 180, letterSpacing: '0.3em' }} placeholder="123456" maxLength={6} inputMode="numeric" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))} />
                      <button className="btn btn-primary" onClick={confirmTwoFa} disabled={busy || twoFaCode.length !== 6}>Verify &amp; enable</button>
                      <button className="btn btn-light border" onClick={() => setTwoFa(null)} disabled={busy}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              {me?.twoFactorEnabled && (
                <div className="d-flex gap-2 align-items-end">
                  <div>
                    <label className="form-label small" htmlFor="st-2fa-disable">Confirm your password to disable 2FA</label>
                    <input id="st-2fa-disable" type="password" className="form-control" style={{ maxWidth: 280 }} value={disablePw} onChange={(e) => setDisablePw(e.target.value)} />
                  </div>
                  <button className="btn btn-outline-danger" onClick={disableTwoFa} disabled={busy || !disablePw}>Disable 2FA</button>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Active sessions</span>
              <button className="btn btn-sm btn-outline-danger" onClick={() => setConfirmRevokeAll(true)}>
                <i className="bi bi-x-circle me-1" />Sign out everywhere
              </button>
            </div>
            <ul className="list-group list-group-flush">
              {(sessionsQ.data?.sessions ?? []).map((s) => (
                <li key={s.id} className="list-group-item d-flex justify-content-between align-items-center px-3">
                  <div className="small">
                    <div className="fw-semibold">
                      {s.current ? 'This device' : 'Other session'}
                      <span className="text-secondary fw-normal"> · {s.ip ?? 'unknown IP'}</span>
                    </div>
                    <div className="text-secondary text-truncate" style={{ maxWidth: 420 }}>{s.userAgent ?? 'Unknown browser'}</div>
                    <div className="text-secondary">Started {new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  {s.current && <span className="badge badge-soft-primary">CURRENT</span>}
                </li>
              ))}
              {(sessionsQ.data?.sessions ?? []).length === 0 && <li className="list-group-item px-3 small text-secondary">No active sessions.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card">
          <div className="card-header">Notification preferences</div>
          <div className="card-body p-4 d-grid gap-3">
            {[
              { key: 'campaignCompletions', title: 'Campaign completions', text: 'Email me when a broadcast campaign finishes processing.' },
              { key: 'automationFailures', title: 'Automation failures', text: 'Email me when an automation repeatedly fails to send.' },
              { key: 'weeklySummary', title: 'Weekly summary', text: 'Send me a weekly performance digest.' },
            ].map((p) => (
              <div className="form-check form-switch d-flex justify-content-between align-items-center border-bottom pb-2" key={p.key}>
                <span>
                  <span className="fw-semibold d-block">{p.title}</span>
                  <span className="small text-secondary">{p.text}</span>
                </span>
                <input
                  className="form-check-input m-0"
                  type="checkbox"
                  role="switch"
                  checked={Boolean(prefs[p.key])}
                  onChange={(e) => setPref(p.key, e.target.checked)}
                  aria-label={p.title}
                />
              </div>
            ))}
            <p className="small text-secondary mb-0">
              <i className="bi bi-info-circle me-1" />Email delivery requires SMTP to be configured by the platform operator; otherwise notifications are recorded in the outbox.
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRevokeAll}
        title="Sign out everywhere"
        message="Revoke all active sessions, including this one? You will need to sign in again."
        confirmLabel="Sign out everywhere"
        busy={busy}
        onConfirm={async () => {
          try {
            await apiCall('/api/auth/sessions?all=1', 'DELETE')
            window.location.href = '/login'
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed', 'danger')
            setConfirmRevokeAll(false)
          }
        }}
        onCancel={() => setConfirmRevokeAll(false)}
      />
    </div>
  )
}
