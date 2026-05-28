import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'

/**
 * Localhost-only background scrape triggers for empty Zone grids.
 * Production stays JIT (Tip +1); enable on prod preview with NEXT_PUBLIC_ZONE_DEV_BOOTSTRAP=1.
 */
export function getDevBootstrapJourneys(): JourneyId[] {
  if (typeof window === 'undefined') return []
  const host = window.location.hostname
  if (host !== '127.0.0.1' && host !== 'localhost') return []
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NEXT_PUBLIC_ZONE_DEV_BOOTSTRAP !== '1') return []
  }
  if (process.env.NEXT_PUBLIC_ZONE_DEV_BOOTSTRAP === '0') return []
  return [...JOURNEY_ORDER]
}

export function isDevZoneBootstrapEnabled(): boolean {
  return getDevBootstrapJourneys().length > 0
}
