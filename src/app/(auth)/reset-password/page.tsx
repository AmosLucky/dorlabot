'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiCall } from '@/hooks/useApi'

function ResetPasswordInner() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await apiCall('/api/auth/reset-password', 'POST', { token, password })
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <i className="bi bi-exclamation-circle text-warning fs-1" />
        <h1 className="h4 fw-bold mt-3">Missing reset token</h1>
        <p className="text-secondary small">Open the reset link from your email, or request a new one.</p>
        <Link href="/forgot-password" className="btn btn-primary">Request new link</Link>
      </div>
    )
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4 p-md-5">
        {done ? (
          <div className="text-center">
            <i className="bi bi-check-circle text-success fs-1" />
            <h1 className="h4 fw-bold mt-3">Password updated</h1>
            <p className="text-secondary small">All sessions were signed out. Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <h1 className="h4 fw-bold mb-1">Choose a new password</h1>
            <p className="text-secondary small mb-4">Pick something strong — at least 8 characters with letters and numbers.</p>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <form onSubmit={submit} className="d-grid gap-3">
              <div>
                <label className="form-label" htmlFor="rp-pass">New password</label>
                <input id="rp-pass" type="password" className="form-control" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="rp-confirm">Confirm new password</label>
                <input id="rp-confirm" type="password" className="form-control" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2-circle me-1" />}
                Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><span className="spinner-border text-primary" /></div>}>
      <ResetPasswordInner />
    </Suspense>
  )
}
