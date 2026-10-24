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
