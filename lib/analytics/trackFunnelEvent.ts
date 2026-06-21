/**
 * Fire-and-forget funnel tracking → POST /api/analytics.
 * Never throws; never blocks UI.
 */
import {
  type FunnelEventName,
  type FunnelEventProps,
  getOrCreateAnalyticsSessionId,
} from '@/lib/analytics/funnelEvents'

const DEDUPE_PREFIX = 'zz_funnel_once:'

/** Track once per tab session (e.g. zone_ready). */
export function trackFunnelEventOnce(
  name: FunnelEventName,
  props: FunnelEventProps = {}
): void {
  if (typeof window === 'undefined') return
  try {
    const key = `${DEDUPE_PREFIX}${name}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // quota / privacy mode — still attempt send
  }
  trackFunnelEvent(name, props)
}

export function trackFunnelEvent(name: FunnelEventName, props: FunnelEventProps = {}): void {
  if (typeof window === 'undefined') return
  const sessionId = getOrCreateAnalyticsSessionId()
  const body = {
    event_type: name,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    props,
  }
  try {
    void fetch('/api/analytics', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch {
    // analytics never blocks
  }
}
