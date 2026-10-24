'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/hooks/useApi'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)

  useEffect(() => {
    apiCall<{ registrationEnabled: boolean }>('/api/auth/register', 'GET')
      .then((r) => setRegistrationEnabled(r.registrationEnabled))
      .catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await apiCall<{ devVerifyUrl?: string; message: string }>('/api/auth/register', 'POST', {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      setDevVerifyUrl(res.devVerifyUrl ?? null)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4 p-md-5 text-center">
          <i className="bi bi-envelope-check text-primary fs-1" />
          <h1 className="h4 fw-bold mt-3 mb-2">Check your inbox</h1>
          <p className="text-secondary small mb-4">
            We sent a verification link to <strong>{form.email}</strong>. Click it to activate your account, then sign in.
          </p>
          {devVerifyUrl && (
            <div className="alert alert-warning small text-start">
              <strong>Development environment:</strong> SMTP email is not configured, so here is the verification link:
              <div className="mt-1 text-break">
                <a href={devVerifyUrl}>Verify my email now →</a>
              </div>
            </div>
          )}
          <Link href="/login" className="btn btn-primary">Go to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4 p-md-5">
        <h1 className="h4 fw-bold mb-1">Create your account</h1>
        <p className="text-secondary small mb-4">Connect your Facebook Page and automate conversations in minutes.</p>
        {!registrationEnabled && (
          <div className="alert alert-warning py-2 small">Registration is temporarily closed. Please contact support.</div>
        )}
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <form onSubmit={submit} className="d-grid gap-3">
          <div>
            <label className="form-label" htmlFor="reg-name">Full name</label>
            <input id="reg-name" className="form-control" required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="form-label" htmlFor="reg-email">Work email</label>
            <input id="reg-email" type="email" className="form-control" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input id="reg-password" type="password" className="form-control" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <div className="form-text">At least 8 characters, letters and numbers.</div>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="reg-confirm">Confirm password</label>
              <input id="reg-confirm" type="password" className="form-control" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy || !registrationEnabled}>
            {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-person-plus me-1" />}
            Create account
          </button>
          <p className="small text-secondary mb-0">
            By creating an account you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </form>
        <p className="small text-secondary mt-3 mb-0">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
