'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/hooks/useApi'

export default function TwoFactorPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pendingToken = sessionStorage.getItem('twofa_pending')
    if (!pendingToken) {
      setError('Your two-factor session expired. Please sign in again.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiCall<{ redirect?: string }>('/api/auth/login', 'POST', {
        email: '',
        password: '',
        pendingTwoFactorToken: pendingToken,
        twoFactorCode: code,
      })
      sessionStorage.removeItem('twofa_pending')
      router.push(res.redirect || '/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setBusy(false)
    }
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4 p-md-5">
        <h1 className="h4 fw-bold mb-1">Two-factor authentication</h1>
        <p className="text-secondary small mb-4">Enter the 6-digit code from your authenticator app.</p>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <form onSubmit={submit} className="d-grid gap-3">
          <div>
            <label className="form-label" htmlFor="twofa-code">Authentication code</label>
            <input
              id="twofa-code"
              className="form-control form-control-lg text-center fw-bold"
              style={{ letterSpacing: '0.4em' }}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button className="btn btn-primary" disabled={busy || code.length !== 6}>
            {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-shield-check me-1" />}
            Verify and sign in
          </button>
        </form>
        <p className="small text-secondary mt-4 mb-0">
          <Link href="/login"><i className="bi bi-arrow-left me-1" />Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
