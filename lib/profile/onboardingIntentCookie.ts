/**
 * "I meant to come to /profile" marker.
 *
 * Replaces the `?skip=1` query string that used to ride on every profile URL. The guard it
 * powers is real — without it, anyone with a complete profile who taps through the intro gets
 * bounced straight back to /zone by the middleware and can never reach onboarding again — but a
 * user-facing URL is the wrong place to carry an internal routing flag.
 *
 * Deliberately short-lived and path-scoped: it is consumed by the very next navigation, so a
 * stale marker can't keep the redirect guard disabled for a whole session.
 */

export const ONBOARDING_INTENT_COOKIE = 'zz_onboarding_intent'

/** Seconds. Long enough to survive the handoff navigation, short enough not to linger. */
const MAX_AGE_SECONDS = 120

export function markOnboardingIntent(): void {
  if (typeof document === 'undefined') return
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${ONBOARDING_INTENT_COOKIE}=1; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  } catch {
    /* cookies blocked — the gate simply falls back to its normal behaviour */
  }
}

export function clearOnboardingIntent(): void {
  if (typeof document === 'undefined') return
  try {
    document.cookie = `${ONBOARDING_INTENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  } catch {
    /* ignore */
  }
}
