'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_ZONE_FILTERS,
  parseZoneFilters,
  ZONE_FILTERS_STORAGE_KEY,
  type ZoneFilterState,
} from '@/lib/zone/filters'

const EVENT = 'zz-zone-filters'

/**
 * Zone filter state. Kept for the tab's session (sessionStorage), so opening a card and coming
 * back keeps your filters, but a new visit starts clean instead of on a filtered page.
 */
export function useZoneFilters() {
  const [state, setState] = useState<ZoneFilterState>(DEFAULT_ZONE_FILTERS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem(ZONE_FILTERS_STORAGE_KEY)
        setState(raw ? parseZoneFilters(JSON.parse(raw)) : DEFAULT_ZONE_FILTERS)
      } catch {
        setState(DEFAULT_ZONE_FILTERS)
      }
    }
    read()
    setReady(true)
    window.addEventListener(EVENT, read)
    return () => window.removeEventListener(EVENT, read)
  }, [])

  const update = useCallback((next: ZoneFilterState) => {
    setState(next)
    try {
      sessionStorage.setItem(ZONE_FILTERS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage blocked: filters still work for this visit */
    }
    window.dispatchEvent(new CustomEvent(EVENT))
  }, [])

  const clear = useCallback(() => update(DEFAULT_ZONE_FILTERS), [update])
  return { state, ready, update, clear }
}
