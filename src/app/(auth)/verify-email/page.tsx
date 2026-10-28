'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiCall } from '@/hooks/useApi'

function VerifyEmailInner() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<'idle' | 'working' | 'ok' | 'error'>(token ? 'working' : 'idle')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(params.get('email') || '')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    apiCall('/api/auth/verify-email', 'POST', { token })
      .then((r) => {
        setState('ok')
        setMessage((r as { message: string }).message)
      })
      .catch((err: Error) => {
        setState('error')
        setMessage(err.message)
      })
  }, [token])

  const resendVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setResending(true)
    setResendMessage('')
    setDevVerifyUrl(null)
    try {
      const result = await apiCall<{ message: string; devVerifyUrl?: string }>(
        '/api/auth/resend-verification',
        'POST',
        { email }
      )
      setResendMessage(result.message)
      setDevVerifyUrl(result.devVerifyUrl ?? null)
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Could not request a verification link.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4 p-md-5 text-center">
        {state === 'working' && (
          <>
            <span className="spinner-border text-primary mb-3" style={{ width: 44, height: 44 }} />
            <h1 className="h4 fw-bold">Verifying your email…</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <i className="bi bi-check-circle text-success fs-1" />
            <h1 className="h4 fw-bold mt-3">Email verified</h1>
            <p className="text-secondary small">{message}</p>
            <Link href="/login" className="btn btn-primary">Sign in</Link>
          </>
        )}
        {(state === 'error' || state === 'idle') && (
          <>
            <i className="bi bi-exclamation-circle text-warning fs-1" />
            <h1 className="h4 fw-bold mt-3">Email verification</h1>
            <p className="text-secondary small">{state === 'error' ? message : 'Open the verification link from your email inbox.'}</p>
            <form onSubmit={resendVerification} className="text-start d-grid gap-3 mb-3">
              <div>
                <label className="form-label" htmlFor="verification-email">Email address</label>
                <input
                  id="verification-email"
                  type="email"
                  className="form-control"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={resending}>
                {resending ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                Send a new verification link
              </button>
            </form>
            {resendMessage && (
              <div className="alert alert-info py-2 small text-start" role="status">
                {resendMessage}
                {devVerifyUrl && (
                  <div className="mt-2 text-break">
                    <strong>Development/testing link:</strong>{' '}
                    <a href={devVerifyUrl}>Open verification link</a>
                  </div>
                )}
              </div>
            )}
            <Link href="/login" className="btn btn-outline-primary">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><span className="spinner-border text-primary" /></div>}>
      <VerifyEmailInner />
    </Suspense>
  )
}
