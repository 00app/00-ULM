/**
 * Client-safe Sentinel types (no `pg` / Node-only imports).
 * Used by `JourneyBentoCard` / `EmbeddedJourneyQuestion` and mirrored by the runner API.
 */

export type SentinelViewState = 'LIVE' | 'RESULT'

export interface MotherChildMotherPayload {
  heading: string
  description: string
  source: string
  sourceUrl: string
  verifiedDate: string
  ctaUrl: string
  saveGbp: number
  carbonKg: number
  category: 'behavioral' | 'structural'
}

export interface MotherChildSlide {
  mother: MotherChildMotherPayload
  child: {
    question: string
    options: string[]
  }
}

export interface SentinelMotherRecardPayload {
  headline: string
  description: string
  moneyValue: number
  carbonValue: number
  source_url: string
  verified_date: string
  viewState: SentinelViewState
  slideCursor: number
  sessionAnswerCount: number
  currentSlide: MotherChildSlide | null
}
