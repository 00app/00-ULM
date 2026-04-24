/**
 * Sync current profile + journey answers + completed journeys to session/IP storage (production).
 * Call after profile save or journey answer submit so returning users get their data back.
 */
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'

const isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'

export function syncSessionState(): void {
  if (typeof window === 'undefined' || !isProduction) return
  const profile = {
    name: localStorage.getItem('profile_name') ?? '',
    postcode: localStorage.getItem('profile_postcode') ?? '',
    household: localStorage.getItem('profile_household') ?? '',
    home_type: localStorage.getItem('profile_home_type') ?? '',
    transport: localStorage.getItem('profile_transport') ?? '',
    age: localStorage.getItem('profile_age') ?? '',
    employment_status: localStorage.getItem('profile_employment_status') ?? '',
  }
  const journeyAnswers: Record<string, Record<string, string>> = {}
  JOURNEY_ORDER.forEach((jid) => {
    const raw = localStorage.getItem(`journey_${jid}_answers`)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, string>
        if (parsed && typeof parsed === 'object') journeyAnswers[jid] = parsed
      } catch {
        // ignore
      }
    }
  })
  const completedRaw = localStorage.getItem('completedJourneys')
  const completedJourneys = completedRaw ? (() => { try { return JSON.parse(completedRaw) as string[] } catch { return [] } })() : []

  fetch('/api/session-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ profile, journeyAnswers, completedJourneys }),
  }).catch(() => {})
}
