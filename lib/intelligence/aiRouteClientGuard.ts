const AI_ROUTE_BLOCKED_KEY = 'zz_ai_route_blocked'

function safeSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Stop repeated protected-route calls after 401/429 on this tab session. */
export function isAiRouteBlockedClient(): boolean {
  const s = safeSessionStorage()
  if (!s) return false
  return s.getItem(AI_ROUTE_BLOCKED_KEY) === '1'
}

export function clearAiRouteBlockedClient(): void {
  const s = safeSessionStorage()
  if (!s) return
  s.removeItem(AI_ROUTE_BLOCKED_KEY)
}

/**
 * Marks the current tab as blocked when protected routes return auth/rate errors.
 * Returns true when the status was a block signal.
 */
export function markAiRouteBlockedFromStatus(status: number): boolean {
  // Dev: 429 is often burst traffic on Zone load (pulse + scrape + sentinel) — do not freeze the wall.
  if (status === 429 && process.env.NODE_ENV === 'development') return false
  if (status !== 401 && status !== 429) return false
  const s = safeSessionStorage()
  if (s) s.setItem(AI_ROUTE_BLOCKED_KEY, '1')
  return true
}
