/**
 * Early mobile capture, ahead of the goal question. Consent is an explicit checkbox on that step
 * (same shape as the Zone signup card's sms_opt_in), so the flag can be sent as true
 * automatically once we actually message them at Zone. Nothing here ever calls out to the
 * network; it only stores what the profile step collected so Zone can pick it up once a session
 * and real content both exist, neither of which is true this early.
 */

export const ONBOARDING_MOBILE_LS = 'zz_onboarding_mobile'
export const ONBOARDING_MOBILE_STEP_SEEN_LS = 'zz_onboarding_mobile_step_seen'
export const ONBOARDING_MOBILE_SMS_SENT_LS = 'zz_onboarding_mobile_sms_sent'

/** The number collected on the early step, if any and if not already sent. */
export function readCapturedOnboardingMobile(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(ONBOARDING_MOBILE_LS)?.trim()
    return v || null
  } catch {
    return null
  }
}

export function markOnboardingMobileSmsSent(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ONBOARDING_MOBILE_SMS_SENT_LS, '1')
  } catch {
    /* ignore */
  }
}

export function onboardingMobileSmsAlreadySent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(ONBOARDING_MOBILE_SMS_SENT_LS) === '1'
  } catch {
    return false
  }
}
