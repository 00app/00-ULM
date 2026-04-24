'use client'

import { useEffect, useState } from 'react'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import { useApp } from '@/app/context/AppContext'

/**
 * Client hook: resolve postcode → LocalIntelligence + short display name (e.g. “Wick”).
 * Uses POST /api/local-intelligence (rate-limited server proxy to Postcodes.io).
 */
export function useLocationIdentity(postcode: string | null | undefined) {
  const { setLocationState } = useApp()
  const [local, setLocal] = useState<LocalIntelligence | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const pc = postcode?.replace(/\s+/g, '').trim() ?? ''
    if (pc.length < 4) {
      setLocal(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const ac = new AbortController()
    const tid = window.setTimeout(() => ac.abort(), 4500)
    fetch('/api/local-intelligence', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcode: pc }),
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || typeof d.council !== 'string') return
        setLocal(d as LocalIntelligence)
      })
      .catch(() => {
        if (!cancelled) setLocal(null)
      })
      .finally(() => {
        window.clearTimeout(tid)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      ac.abort()
      window.clearTimeout(tid)
    }
  }, [postcode])

  const locationName = formatLocationDisplayName(local, postcode ?? undefined)

  useEffect(() => {
    if (!postcode?.trim()) {
      setLocationState(null)
      return
    }
    setLocationState({ locationName, local })
  }, [postcode, locationName, local, setLocationState])

  return { local, locationName, loading }
}
