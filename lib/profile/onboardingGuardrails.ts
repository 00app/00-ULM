/**
 * Onboarding field guardrails — each profile answer gates scrape tone, journey priority, and zone unlocks.
 * Logic-only; consumed by research payloads, answer funnel, and scrape-sync triggers.
 */

import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import type { JourneyId } from '@/lib/journeys'
import { normalizeProfileGoalValue, type ProfileGoalValue } from '@/lib/profile/goalWeighting'
import {
  inferHouseholdIncomeBracket,
  normalizeHouseholdIncomeBracket,
} from '@/lib/profile/inferHouseholdIncomeBracket'
import { profileHomePowerToEnergyType } from '@/lib/profile/homePower'
import { isUtilitiesZoneCardUnlocked } from '@/lib/zone/utilitiesZoneUnlock'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import { buildPropertyResearchSignals } from '@/lib/intelligence/answerFunnelRouter'
import type { LocalizedProfileInput } from '@/lib/intelligence/researchProfilePayload'

export type OnboardingFieldKey =
  | 'goal'
  | 'postcode'
  | 'house_number'
  | 'household'
  | 'home_type'
  | 'home_power'
  | 'transport'
  | 'age'
  | 'employment_status'
  | 'household_income_bracket'

/** Per-field intelligence contract — documents how each answer shapes the funnel. */
export const ONBOARDING_FIELD_GUARDRAILS: Record<
  OnboardingFieldKey,
  { required: boolean; funnelEffect: string; scrapeUnlock?: JourneyId[] }
> = {
  goal: {
    required: true,
    funnelEffect:
      'Leading question: money → grants/money/shopping/travel JIT; carbon → solar/travel/food; balanced → mixed cap-4 list.',
    scrapeUnlock: ['grants', 'money', 'carbon'],
  },
  postcode: {
    required: true,
    funnelEffect: 'Anchors council region, IMD, flood, solar, DNO, and all Neon research_results scope.',
  },
  house_number: {
    required: false,
    funnelEffect: 'EPC + Land Registry address match — tightens property_intelligence confidence.',
  },
  household: {
    required: true,
    funnelEffect: 'Household size scales £/kg impact math and food/waste journey seeds.',
    scrapeUnlock: ['food', 'waste'],
  },
  home_type: {
    required: true,
    funnelEffect: 'Detached/semi/flat gates fabric vs behaviour tips on home journey.',
    scrapeUnlock: ['home'],
  },
  home_power: {
    required: true,
    funnelEffect: 'GAS/ELECTRIC/MIX unlocks utilities tile and seeds utilities/home MC answers.',
    scrapeUnlock: ['utilities', 'home'],
  },
  transport: {
    required: true,
    funnelEffect: 'Car/rail/mix baseline for travel carbon and commute swap offers.',
    scrapeUnlock: ['travel'],
  },
  age: {
    required: true,
    funnelEffect: 'JUNIOR/MID/RETIRED adjusts grant eligibility tone and income inference.',
  },
  employment_status: {
    required: true,
    funnelEffect: 'Employed → asset optimization; unemployed → bill survival + grant seeds.',
    scrapeUnlock: ['grants', 'money'],
  },
  household_income_bracket: {
    required: false,
    funnelEffect: 'Inferred when absent — suppresses or boosts means-tested grant copy in scrapes.',
    scrapeUnlock: ['grants'],
  },
}

export type ProfileValuesInput = Record<string, string | null | undefined>

function compactPostcode(raw?: string | null): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

/** Validate required onboarding fields are present (client storage or API body). */
export function onboardingFieldsComplete(values: ProfileValuesInput): boolean {
  const goal = normalizeProfileGoalValue(values.goal ?? values.profile_goal)
  const pc = compactPostcode(values.postcode)
  const power = values.powerType ?? values.home_power ?? values.profile_home_power
  return Boolean(
    goal &&
      pc.length >= 4 &&
      values.name?.trim() &&
      (values.livingSituation ?? values.household)?.trim() &&
      (values.homeType ?? values.home_type)?.trim() &&
      (values.transport ?? values.transport_baseline)?.trim() &&
      (values.age ?? values.age_group)?.trim() &&
      (values.employmentStatus ?? values.employment_status)?.trim() &&
      power?.trim()
  )
}

/** Build localized profile signals with guardrails + inferred income. */
export function buildOnboardingProfileSignals(
  values: ProfileValuesInput,
  opts?: {
    postcode?: string
    propertyIntelligence?: PropertyIntelligence | null
  }
): LocalizedProfileInput {
  const goal = normalizeProfileGoalValue(values.goal ?? values.profile_goal)
  const power = values.powerType ?? values.home_power ?? values.profile_home_power
  const pc = compactPostcode(opts?.postcode ?? values.postcode)
  const pi = opts?.propertyIntelligence
  const imd = pi?.deprivation?.imdDecile
  const storedIncome = normalizeHouseholdIncomeBracket(
    values.household_income_bracket ?? values.householdIncomeBracket
  )
  const inferredIncome =
    storedIncome ??
    inferHouseholdIncomeBracket({
      employment_status: values.employmentStatus ?? values.employment_status,
      age_group: values.age ?? values.age_group,
      postcode: pc,
      imd_decile: imd,
      property_value_band: pi?.landRegistry?.propertyValueBand,
    })

  const base: LocalizedProfileInput = {
    ...(pc.length >= 4 ? { postcode: pc } : {}),
    home_type: values.homeType ?? values.home_type ?? undefined,
    home_power: power?.trim().toUpperCase() || undefined,
    heating: profileHomePowerToEnergyType(power) || undefined,
    transport_baseline: values.transport ?? values.transport_baseline ?? undefined,
    household: values.livingSituation ?? values.household ?? undefined,
    employment_status: values.employmentStatus ?? values.employment_status ?? undefined,
    house_number: (values.houseNumber ?? values.house_number)?.trim() || undefined,
    goal,
    primary_goal: goal,
    household_income_bracket: inferredIncome ?? undefined,
    imd_decile: imd,
  }

  return buildPropertyResearchSignals(base, pi)
}

/** ResearchProfileData for scrape-sync — full guardrailed payload. */
export function buildGuardrailedResearchProfile(
  values: ProfileValuesInput,
  opts?: {
    postcode?: string
    propertyIntelligence?: PropertyIntelligence | null
  }
): ResearchProfileData {
  const signals = buildOnboardingProfileSignals(values, opts)
  const ageRaw = values.age ?? values.age_group
  const age =
    typeof ageRaw === 'string' && ['JUNIOR', 'MID', 'RETIRED'].includes(ageRaw.trim().toUpperCase())
      ? ageRaw.trim().toUpperCase()
      : undefined

  const out: ResearchProfileData = {}
  const set = (k: keyof ResearchProfileData, v: string | null | undefined) => {
    const t = v?.trim()
    if (t) out[k] = t
  }
  set('postcode', signals.postcode)
  set('home_type', signals.home_type)
  set('home_power', signals.home_power)
  set('heating', signals.heating)
  set('transport_baseline', signals.transport_baseline)
  set('household', signals.household)
  set('employment_status', signals.employment_status)
  set('house_number', signals.house_number)
  set('household_income_bracket', signals.household_income_bracket)
  set('goal', signals.goal)
  set('primary_goal', signals.primary_goal)
  if (age) out.age_group = age
  if (signals.imd_decile != null) out.imd_decile = String(signals.imd_decile)
  if (signals.property_value_band) out.property_value_band = signals.property_value_band
  if (signals.epc_rating) out.epc_rating = signals.epc_rating
  if (signals.flood_risk_zone) out.flood_risk_zone = signals.flood_risk_zone
  if (signals.solar_irradiance_kwh_m2 != null) {
    out.solar_irradiance_kwh_m2 = String(signals.solar_irradiance_kwh_m2)
  }
  return out
}

/** Journeys that must be prioritized when corresponding guardrail fields are set. */
export function guardrailPriorityJourneys(signals: LocalizedProfileInput): JourneyId[] {
  const goal = normalizeProfileGoalValue(signals.goal ?? signals.primary_goal) as ProfileGoalValue
  const list: JourneyId[] = ['home']
  if (isUtilitiesZoneCardUnlocked({ home_power: signals.home_power })) list.push('utilities')
  if (goal === 'money') list.push('grants', 'money', 'shopping')
  else if (goal === 'carbon') list.push('carbon', 'solar', 'travel')
  else list.push('grants', 'travel', 'food')
  const transport = String(signals.transport_baseline ?? '').toLowerCase()
  if (transport.includes('car') || transport.includes('drive')) list.push('travel')
  if (signals.flood_risk_zone && signals.flood_risk_zone !== 'LOW') list.push('water')
  if (signals.solar_irradiance_kwh_m2 != null && signals.solar_irradiance_kwh_m2 >= 900) {
    list.push('solar')
  }
  return [...new Set(list)]
}
