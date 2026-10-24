'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/hooks/useApi'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await apiCall<{ twoFactorRequired?: boolean; pendingToken?: string; redirect?: string }>('/api/auth/login', 'POST', form)
      if (res.twoFactorRequired && res.pendingToken) {
        sessionStorage.setItem('twofa_pending', res.pendingToken)
        router.push('/login/2fa')
        return
      }
      router.push(res.redirect || '/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setBusy(false)
    }
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4 p-md-5">
        <h1 className="h4 fw-bold mb-1">Welcome back</h1>
        <p className="text-secondary small mb-4">Sign in to manage your Pages and automations.</p>
        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            {error}
            {error.includes('verify your email') && (
              <div className="mt-1">
                <Link href="/verify-email" className="alert-link">Need a new verification link?</Link>
              </div>
            )}
          </div>
        )}
        <form onSubmit={submit} className="d-grid gap-3">
          <div>
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <div className="d-flex justify-content-between align-items-center">
              <label className="form-label" htmlFor="login-password">Password</label>
              <Link href="/forgot-password" className="small">Forgot password?</Link>
            </div>
            <div className="input-group">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-box-arrow-in-right me-1" />}
            Sign in
          </button>
        </form>
        <p className="small text-secondary mt-4 mb-0">
          New to DorlaCode? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
