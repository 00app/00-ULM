import type { JourneyId } from '@/lib/journeys'
import {
  normalizeProfileGoalValue,
  type ProfileGoalValue,
} from '@/lib/profile/goalWeighting'
import { isUtilitiesZoneCardUnlocked } from '@/lib/zone/utilitiesZoneUnlock'

/** Free-tier cap — home + utilities + two goal-aligned domains (not all 13 journeys). */
export const ONBOARDING_JIT_CAP = 4

const GOAL_JOURNEY_PRIORITIES: Record<ProfileGoalValue, JourneyId[]> = {
  money: ['grants', 'money', 'shopping', 'travel'],
  carbon: ['carbon', 'solar', 'travel', 'food'],
  balanced: ['grants', 'travel', 'food', 'money'],
}

/** Goal + profile power → surgical JIT list (Topic Shield — one journey_key per scrape). */
export function resolveOnboardingResearchJourneys(params: {
  goal?: string | null
  home_power?: string | null
}): JourneyId[] {
  const goal = normalizeProfileGoalValue(params.goal)
  const out: JourneyId[] = ['home']

  if (isUtilitiesZoneCardUnlocked({ home_power: params.home_power })) {
    out.push('utilities')
  }

  for (const jid of GOAL_JOURNEY_PRIORITIES[goal]) {
    if (out.includes(jid)) continue
    out.push(jid)
    if (out.length >= ONBOARDING_JIT_CAP) break
  }

  return out.slice(0, ONBOARDING_JIT_CAP)
}
