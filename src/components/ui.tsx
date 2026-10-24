'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// ── Static states ────────────────────────────────────────────────────

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="d-flex align-items-center justify-content-center py-5 text-secondary" role="status">
      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-5">
      <i className="bi bi-exclamation-triangle text-warning fs-1" aria-hidden="true" />
      <p className="mt-3 mb-3 text-secondary">{message}</p>
      {onRetry && (
        <button className="btn btn-outline-primary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="text-center py-5 px-3">
      <div className="feature-icon mx-auto mb-3" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </div>
      <h5 className="fw-semibold mb-1">{title}</h5>
      <p className="text-secondary mb-4 mx-auto" style={{ maxWidth: 460 }}>
        {description}
      </p>
      {action}
    </div>
  )
}

// ── Status badges ────────────────────────────────────────────────────

const BADGE_MAP: Record<string, string> = {
  ACTIVE: 'badge-soft-success',
  CONNECTED: 'badge-soft-success',
  SENT: 'badge-soft-primary',
  DELIVERED: 'badge-soft-info',
  READ: 'badge-soft-info',
  PROCESSED: 'badge-soft-success',
  COMPLETED: 'badge-soft-success',
  ELIGIBLE: 'badge-soft-success',
  PAUSED: 'badge-soft-warning',
  SCHEDULED: 'badge-soft-info',
  LAUNCHING: 'badge-soft-info',
  SENDING: 'badge-soft-info',
  QUEUED: 'badge-soft-secondary',
  PENDING: 'badge-soft-secondary',
  UNKNOWN: 'badge-soft-secondary',
  DISCONNECTED: 'badge-soft-secondary',
  SKIPPED: 'badge-soft-warning',
  INELIGIBLE: 'badge-soft-warning',
  TOKEN_EXPIRED: 'badge-soft-warning',
  ERROR: 'badge-soft-danger',
  FAILED: 'badge-soft-danger',
  OPTED_OUT: 'badge-soft-danger',
  BLOCKED: 'badge-soft-danger',
  SUSPENDED: 'badge-soft-danger',
  CANCELLED: 'badge-soft-secondary',
  DRAFT: 'badge-soft-secondary',
  RECEIVED: 'badge-soft-secondary',
  RETRYING: 'badge-soft-warning',
  RESOLVED: 'badge-soft-success',
}

export function StatusBadge({ status }: { status: string }) {
  const cls = BADGE_MAP[status] ?? 'badge-soft-secondary'
  const label = status.replace(/_/g, ' ').toLowerCase()
  return <span className={`badge ${cls} text-uppercase`} style={{ fontSize: '0.68rem' }}>{label}</span>
}

// ── Toasts ───────────────────────────────────────────────────────────

export function showToast(message: string, variant: 'success' | 'danger' | 'warning' | 'info' = 'success') {
  const host = document.querySelector('.toast-host')
  if (!host) return
  const el = document.createElement('div')
  el.className = `toast align-items-center text-bg-${variant} border-0`
  el.setAttribute('role', 'alert')
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`
  host.appendChild(el)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bs = (window as any).bootstrap
  if (bs?.Toast) {
    const t = new bs.Toast(el, { delay: 4000 })
    t.show()
    el.addEventListener('hidden.bs.toast', () => el.remove())
  } else {
    setTimeout(() => el.remove(), 4000)
  }
}

// ── Confirm modal (declarative) ──────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || !ref.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bs = (window as any).bootstrap
    if (!bs?.Modal) return
    const modal = bs.Modal.getOrCreateInstance(ref.current)
    modal.show()
    const onHidden = () => onCancel()
    ref.current.addEventListener('hidden.bs.modal', onHidden)
    return () => {
      ref.current?.removeEventListener('hidden.bs.modal', onHidden)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open && !ref.current) return null
  return (
    <div className="modal fade" tabIndex={-1} ref={ref} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
          </div>
          <div className="modal-body">
            <p className="mb-0">{message}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-light" data-bs-dismiss="modal" disabled={busy}>
              Cancel
            </button>
            <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
              {busy ? <span className="spinner-border spinner-border-sm me-1" /> : null}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pagination ───────────────────────────────────────────────────────

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages: number[] = []
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i)
  return (
    <nav aria-label="Pagination" className="mt-3">
      <ul className="pagination pagination-sm justify-content-center mb-0">
        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onPage(page - 1)} disabled={page <= 1}>
            <i className="bi bi-chevron-left" />
          </button>
        </li>
        {pages.map((p) => (
          <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
            <button className="page-link" onClick={() => onPage(p)}>
              {p}
            </button>
          </li>
        ))}
        <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
            <i className="bi bi-chevron-right" />
          </button>
        </li>
      </ul>
    </nav>
  )
}

// ── Copyable text ────────────────────────────────────────────────────

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'} me-1`} />
      {copied ? 'Copied' : label || 'Copy'}
    </button>
  )
}
