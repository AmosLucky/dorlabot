'use client'

import { useEffect } from 'react'

/** Loads Bootstrap 5 JS bundle (dropdowns, modals, toasts, collapses, tooltips). */
export default function BootstrapClient() {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js').catch(() => {})
  }, [])
  return null
}
