'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiCall } from '@/hooks/useApi'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await apiCall<{ devResetUrl?: string }>('/api/auth/forgot-password', 'POST', { email })
      setDevResetUrl(res.devResetUrl ?? null)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4 p-md-5">
        {sent ? (
          <div className="text-center">
            <i className="bi bi-envelope-check text-primary fs-1" />
            <h1 className="h4 fw-bold mt-3 mb-2">Check your inbox</h1>
            <p className="text-secondary small mb-4">If an account exists for {email}, a reset link is on its way. The link expires in 30 minutes.</p>
            {devResetUrl && (
              <div className="alert alert-warning small text-start">
                <strong>Development environment:</strong> SMTP not configured — use this link:
                <div className="mt-1 text-break"><a href={devResetUrl}>Reset my password now →</a></div>
              </div>
            )}
            <Link href="/login" className="btn btn-outline-primary">Back to sign in</Link>
          </div>
        ) : (
          <>
            <h1 className="h4 fw-bold mb-1">Reset your password</h1>
            <p className="text-secondary small mb-4">Enter your account email and we&apos;ll send you a reset link.</p>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <form onSubmit={submit} className="d-grid gap-3">
              <div>
                <label className="form-label" htmlFor="fp-email">Email</label>
                <input id="fp-email" type="email" className="form-control" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-key me-1" />}
                Send reset link
              </button>
            </form>
            <p className="small text-secondary mt-4 mb-0"><Link href="/login"><i className="bi bi-arrow-left me-1" />Back to sign in</Link></p>
          </>
        )}
      </div>
    </div>
  )
}
