import type { JourneyId } from '@/lib/journeys'
import {
  ANSWER_FUNNEL_JIT_CAP,
  buildAnswerFunnel,
} from '@/lib/intelligence/answerFunnelRouter'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import type { LocalizedProfileInput } from '@/lib/intelligence/researchProfilePayload'

/** Free-tier cap — home + utilities + property/goal-aligned domains (not all 13 journeys). */
export const ONBOARDING_JIT_CAP = ANSWER_FUNNEL_JIT_CAP

/** Goal + profile + property_intelligence → surgical JIT list (Topic Shield — one journey_key per scrape). */
export function resolveOnboardingResearchJourneys(params: {
  goal?: string | null
  home_power?: string | null
  employment_status?: string | null
  household_income_bracket?: string | null
  postcode?: string | null
  propertyIntelligence?: PropertyIntelligence | null
  journeyAnswers?: Partial<Record<JourneyId, Record<string, string>>>
}): JourneyId[] {
  const profile: LocalizedProfileInput = {
    goal: params.goal,
    primary_goal: params.goal,
    home_power: params.home_power,
    employment_status: params.employment_status,
    household_income_bracket: params.household_income_bracket,
    postcode: params.postcode,
    imd_decile: params.propertyIntelligence?.deprivation?.imdDecile,
  }
  return buildAnswerFunnel({
    profile,
    propertyIntelligence: params.propertyIntelligence,
    journeyAnswers: params.journeyAnswers,
    cap: ONBOARDING_JIT_CAP,
  }).priorityJourneys
}
