'use client'

import { useState } from 'react'
import { apiCall } from '@/hooks/useApi'
import { showToast } from '@/components/ui'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiCall('/api/contact', 'POST', form)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-5">
      <div className="container py-lg-4" style={{ maxWidth: 860 }}>
        <div className="text-center mb-5">
          <h1 className="fw-bold display-6">Contact us</h1>
          <p className="lead text-secondary">Questions about setup, Meta App Review, or your account — we usually reply within one business day.</p>
        </div>
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="soft-panel p-4 h-100">
              <h5 className="fw-semibold mb-3"><i className="bi bi-envelope-paper me-2 text-primary" />Support</h5>
              <p className="text-secondary small mb-1"><strong>Email:</strong> support@dorlacode.com</p>
              <p className="text-secondary small mb-1"><strong>Hours:</strong> Mon–Fri, 9:00–17:00 (WAT)</p>
              <p className="text-secondary small mb-3"><strong>Response time:</strong> within 1 business day</p>
              <hr />
              <h6 className="fw-semibold">Before writing in</h6>
              <p className="text-secondary small mb-0">
                Many setup questions are answered in the <a href="/faq">FAQ</a> and the in-app <a href="/dashboard/help">Help &amp; support</a> page —
                including Meta App Review guidance and webhook troubleshooting.
              </p>
            </div>
          </div>
          <div className="col-lg-7">
            {sent ? (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="bi bi-check-circle text-success fs-1" />
                  <h4 className="fw-semibold mt-3">Message sent</h4>
                  <p className="text-secondary mb-0">Thanks for reaching out — we&apos;ll get back to you shortly.</p>
                </div>
              </div>
            ) : (
              <form className="card" onSubmit={submit}>
                <div className="card-body p-4">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="c-name">Your name</label>
                      <input id="c-name" className="form-control" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="c-email">Email</label>
                      <input id="c-email" type="email" className="form-control" required maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label" htmlFor="c-subject">Subject</label>
                      <input id="c-subject" className="form-control" required maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label" htmlFor="c-message">Message</label>
                      <textarea id="c-message" className="form-control" rows={6} required maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <button className="btn btn-primary px-4" disabled={busy}>
                        {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-send me-1" />}
                        Send message
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
