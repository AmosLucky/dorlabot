'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ApiState<T> = {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
  setData: (data: T | null) => void
}

/** Small fetch hook with consistent error extraction from our API envelope. */
export function useApi<T = unknown>(url: string | null, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const aborted = useRef(false)

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }
    aborted.current = false
    setLoading(true)
    setError(null)
    fetch(url, { credentials: 'same-origin' })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null
        if (aborted.current) return
        if (!res.ok || !body?.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`)
        setData(body.data ?? null)
      })
      .catch((err: Error) => {
        if (!aborted.current) setError(err.message)
      })
      .finally(() => {
        if (!aborted.current) setLoading(false)
      })
    return () => {
      aborted.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps])

  const refetch = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, refetch, setData }
}

/** POST/PUT/PATCH/DELETE helper returning parsed envelope or throwing Error. */
export async function apiCall<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null
  if (!res.ok || !json?.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`)
  return json.data as T
}
