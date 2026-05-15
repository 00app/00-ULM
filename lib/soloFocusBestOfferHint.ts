import type { JourneyId } from '@/lib/journeys'

/** Nudge Firecrawl / Gemini toward one high-trust UK action URL after Solo Focus audit completes. */
export function buildSoloFocusBestOfferHint(params: {
  journeyId?: JourneyId | string | null
  questionId?: string | null
  answerValue?: string | null
  journeyAnswers?: Record<string, Record<string, string>> | null | undefined
}): string {
  const parts: string[] = ['solo_focus_audit_complete=true']
  if (params.journeyId) parts.push(`journey=${params.journeyId}`)
  if (params.questionId && params.answerValue != null && String(params.answerValue).trim()) {
    parts.push(`last_answer=${params.questionId}=${String(params.answerValue).trim().slice(0, 160)}`)
  }
  const answers = params.journeyAnswers ?? {}
  const travel = answers.travel ?? {}
  const home = answers.home ?? {}
  const tech = answers.tech ?? {}
  const pt = `${travel.primary_transport ?? ''}`.toUpperCase()
  const ft = `${travel.fuel_type ?? ''}`.toUpperCase()
  const et = `${home.energy_type ?? ''}`.toUpperCase()

  if (ft.includes('ELECTRIC') || ft.includes('EV')) {
    parts.push('bias=OZEV_chargepoint_grant;gov.uk_ev_guidance;off_peak_tariff')
  }
  if (pt.includes('CAR')) {
    parts.push('bias=hiyacar_peer_hire;justpark_driveway_rent_if_signals')
  }
  if (et === 'GAS' || et === 'MIXED') {
    parts.push('bias=mse_cheap_energy_club;ofgem_price_cap;knowledge_boiler_tune')
  }
  const recycle = `${tech.recycle_old_devices ?? tech.device_disposal ?? ''}`.toLowerCase()
  if (recycle.includes('sell') || recycle.includes('trade')) {
    parts.push('bias=circular_handset_refurb_buyback')
  }
  return `${parts.join(' | ')}. Return one evidenced action URL plus £ saving context when stated on-page.`.slice(
    0,
    1200
  )
}
