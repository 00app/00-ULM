/**
 * Answer funnel — routes JIT scrape priority from profile + property_intelligence + loop answers.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import {
  normalizeProfileGoalValue,
  type ProfileGoalValue,
} from '@/lib/profile/goalWeighting'
import { guardrailPriorityJourneys } from '@/lib/profile/onboardingGuardrails'
import { isBetweenJobs, isStudent } from '@/lib/profile/employmentSegment'
import { resolveAffluenceAuditMode } from '@/lib/zone/affluenceCheck'
import { isUtilitiesZoneCardUnlocked } from '@/lib/zone/utilitiesZoneUnlock'
import { isHighDeprivationArea, isLowDeprivationArea } from '@/lib/intelligence/deprivationClient'
import { isHighFloodRisk } from '@/lib/intelligence/floodRiskClient'
import { isHighSolarPotential } from '@/lib/intelligence/solarIrradianceClient'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import type { LocalizedProfileInput } from '@/lib/intelligence/researchProfilePayload'

/**
 * All journeys — was capped at 4 to limit paid Firecrawl+Gemini spend. ZeroAgent (free-tier
 * direct Gemini + free UK data APIs, see lib/agents/zeroAgent.ts) is now the primary onboarding
 * research path, and this fires fire-and-forget in the background (never blocks the UI) — so
 * there's no longer a cost/latency reason to leave 9 of 13 categories generic until a JIT click
 * or the weekly Hermes sweep happens to reach them.
 */
export const ANSWER_FUNNEL_JIT_CAP = JOURNEY_ORDER.length

export type AnswerFunnelTone = 'bill_survival' | 'asset_optimization'

export type AnswerFunnelResult = {
  priorityJourneys: JourneyId[]
  suppressJourneys: JourneyId[]
  extraSeedUrls: string[]
  toneMode: AnswerFunnelTone
  deprioritizeMeansTestedGrants: boolean
  boostSolar: boolean
  suppressBasementInsulation: boolean
  /** Merged profile signals for Firecrawl/Gemini prefix. */
  profileSignals: LocalizedProfileInput
}

const GOAL_JOURNEY_PRIORITIES: Record<ProfileGoalValue, JourneyId[]> = {
  money: ['money', 'shopping', 'travel'],
  carbon: ['carbon', 'solar', 'travel', 'food'],
  balanced: ['travel', 'food', 'money'],
}

function scoreJourneys(params: {
  goal: ProfileGoalValue
  profile: LocalizedProfileInput
  propertyIntelligence?: PropertyIntelligence | null
  journeyAnswers?: Partial<Record<JourneyId, Record<string, string>>>
}): Map<JourneyId, number> {
  const scores = new Map<JourneyId, number>()
  // Baseline every journey at 0 so a category with no matching bump condition (shopping, tech,
  // waste, water, carbon, holidays for many profiles) still appears in the ranked candidate list.
  // The cap is now JOURNEY_ORDER.length (all journeys) — without this, uncapped no longer meant
  // "all categories fire," it meant "every category that happened to score is uncapped."
  for (const jid of JOURNEY_ORDER) scores.set(jid, 0)
  const bump = (jid: JourneyId, n: number) => scores.set(jid, (scores.get(jid) ?? 0) + n)

  bump('home', 100)
  if (isUtilitiesZoneCardUnlocked({ home_power: params.profile.home_power })) {
    bump('utilities', 90)
  }

  for (const [i, jid] of GOAL_JOURNEY_PRIORITIES[params.goal].entries()) {
    bump(jid, 70 - i * 5)
  }

  const pi = params.propertyIntelligence
  const imd = params.profile.imd_decile ?? pi?.deprivation?.imdDecile
  if (isHighDeprivationArea(imd)) {
    bump('money', 15)
  }
  if (isLowDeprivationArea(imd)) {
    bump('solar', 25)
    bump('utilities', 20)
    bump('tech', 10)
  }

  if (isHighSolarPotential(pi?.solar?.annualIrradianceKwhM2)) {
    bump('solar', 35)
  }

  if (isHighFloodRisk(pi?.flood?.floodRiskZone)) {
    bump('water', 25)
  }

  const valueBand = pi?.landRegistry?.propertyValueBand
  if (valueBand === '500K_PLUS') {
    bump('solar', 15)
    bump('tech', 10)
  }

  const answers = params.journeyAnswers ?? {}
  for (const jid of JOURNEY_ORDER) {
    const qMap = answers[jid]
    if (!qMap || Object.keys(qMap).length === 0) continue
    bump(jid, 12 + Object.keys(qMap).length * 4)
  }

  if (params.profile.employment_status) {
    const aff = resolveAffluenceAuditMode({
      employment_status: params.profile.employment_status,
      postcode: params.profile.postcode,
      household_income_bracket: params.profile.household_income_bracket,
    })
    if (aff.mode === 'asset_optimization') {
      bump('solar', 10)
      bump('utilities', 8)
    }
    if (isStudent(params.profile.employment_status)) {
      bump('food', 10)
      bump('shopping', 8)
      bump('tech', 6)
    }
    if (isBetweenJobs(params.profile.employment_status)) {
      bump('food', 6)
      bump('waste', 5)
      bump('home', 4)
    }
  }

  const transport = (params.profile.transport_baseline ?? '').toLowerCase()
  if (transport.includes('car')) {
    bump('travel', 25)
    bump('money', 10)
  } else if (transport.includes('bike') || transport.includes('cycl')) {
    bump('carbon', 10)
    bump('travel', 5)
  } else if (transport.includes('bus') || transport.includes('train') || transport.includes('rail') || transport.includes('public')) {
    bump('travel', 10)
    bump('carbon', 5)
  }

  const household = (params.profile.household ?? '').toLowerCase()
  if (household.includes('famil') || household === 'family') {
    bump('food', 15)
    bump('water', 10)
    bump('shopping', 8)
    bump('waste', 8)
  } else if (household.includes('shared') || household.includes('housemate')) {
    bump('food', 8)
    bump('waste', 8)
    bump('tech', 5)
  }

  const homeType = (params.profile.home_type ?? '').toLowerCase()
  if (homeType.includes('flat') || homeType.includes('apartment')) {
    bump('solar', -30)
    bump('utilities', 10)
  } else if (homeType.includes('house') || homeType.includes('detach') || homeType.includes('semi') || homeType.includes('terrac') || homeType.includes('bungalow')) {
    bump('solar', 15)
    bump('home', 8)
  }

  for (const [i, jid] of guardrailPriorityJourneys(params.profile).entries()) {
    bump(jid, 45 - i * 3)
  }

  return scores
}

export function buildPropertyResearchSignals(
  base: LocalizedProfileInput,
  propertyIntelligence?: PropertyIntelligence | null
): LocalizedProfileInput {
  if (!propertyIntelligence) return base
  const pi = propertyIntelligence
  return {
    ...base,
    imd_decile: base.imd_decile ?? pi.deprivation?.imdDecile,
    property_confidence: pi.confidence,
    epc_rating: pi.epc?.currentEnergyRating,
    epc_potential_rating: pi.epc?.potentialEnergyRating,
    epc_stale: pi.epc?.isStale === true,
    property_value_band: pi.landRegistry?.propertyValueBand,
    flood_risk_zone: pi.flood?.floodRiskZone,
    solar_irradiance_kwh_m2: pi.solar?.annualIrradianceKwhM2,
    dno_region: pi.dno?.dnoRegion,
    lsoa_code: pi.deprivation?.lsoaCode ?? pi.geo?.lsoaCode,
  }
}

export function buildAnswerFunnel(params: {
  profile: LocalizedProfileInput
  propertyIntelligence?: PropertyIntelligence | null
  journeyAnswers?: Partial<Record<JourneyId, Record<string, string>>>
  /** When set, bias surgical scrape to this journey (loop answer path). */
  activeJourneyId?: JourneyId | null
  cap?: number
}): AnswerFunnelResult {
  const cap = params.cap ?? ANSWER_FUNNEL_JIT_CAP
  const goal = normalizeProfileGoalValue(params.profile.goal ?? params.profile.primary_goal)
  const profileSignals = buildPropertyResearchSignals(params.profile, params.propertyIntelligence)
  const aff = resolveAffluenceAuditMode({
    employment_status: profileSignals.employment_status,
    postcode: profileSignals.postcode,
    household_income_bracket: profileSignals.household_income_bracket,
    primary_goal: profileSignals.primary_goal,
  })

  const imd = profileSignals.imd_decile
  const deprivedArea = isHighDeprivationArea(imd)
  const affluentArea = isLowDeprivationArea(imd)
  const boostSolar = isHighSolarPotential(params.propertyIntelligence?.solar?.annualIrradianceKwhM2)
  const suppressBasementInsulation = isHighFloodRisk(params.propertyIntelligence?.flood?.floodRiskZone)

  const suppressJourneys: JourneyId[] = []
  if (suppressBasementInsulation) {
    /* Home fabric tips that assume dry basements are de-prioritised in copy — not journey removal. */
  }

  const scores = scoreJourneys({
    goal,
    profile: profileSignals,
    propertyIntelligence: params.propertyIntelligence,
    journeyAnswers: params.journeyAnswers,
  })

  if (params.activeJourneyId) {
    scores.set(params.activeJourneyId, (scores.get(params.activeJourneyId) ?? 0) + 50)
  }

  const ranked = [...scores.entries()]
    .filter(([jid]) => !suppressJourneys.includes(jid))
    .sort((a, b) => b[1] - a[1])
    .map(([jid]) => jid)

  const priorityJourneys: JourneyId[] = []
  for (const jid of ranked) {
    if (priorityJourneys.includes(jid)) continue
    priorityJourneys.push(jid)
    if (priorityJourneys.length >= cap) break
  }

  const extraSeedUrls: string[] = []
  if (deprivedArea) {
    extraSeedUrls.push(
      'https://www.gov.uk/apply-warm-homes-local-grant',
      'https://www.gov.uk/energy-company-obligation'
    )
  }
  if (affluentArea || aff.mode === 'asset_optimization') {
    extraSeedUrls.push('https://octopus.energy/smart/')
  }
  if (boostSolar) {
    extraSeedUrls.push(
      'https://energysavingtrust.org.uk/energy-at-home/generating-your-own-energy/solar-panels/'
    )
  }
  if (suppressBasementInsulation) {
    extraSeedUrls.push('https://www.gov.uk/guidance/flood-risk')
  }

  return {
    priorityJourneys,
    suppressJourneys,
    extraSeedUrls,
    toneMode: aff.mode,
    deprioritizeMeansTestedGrants: aff.deprioritizeMeansTestedGrants,
    boostSolar,
    suppressBasementInsulation,
    profileSignals,
  }
}

/** Ground-truth block for Gemini — separates register facts from scraped offers. */
export function buildDataTruthContextBlock(params: {
  propertyIntelligence?: PropertyIntelligence | null
  profileSignals?: LocalizedProfileInput | null
}): string {
  const pi = params.propertyIntelligence
  const ps = params.profileSignals
  const lines = [
    'DATA TRUTH LAYER (mandatory):',
    '- EPC / Land Registry / IMD / flood / solar / DNO rows below are REGISTER or ONS facts — cite as property facts, not offers.',
    '- Firecrawl markdown may contain marketing — only surface £/year figures and offer URLs that appear verbatim in scraped text.',
    '- If scraped text lacks a number or https URL, use COMPUTING tone — never invent grant amounts or retailer deals.',
    '- Offer URLs must be https and from .gov.uk, .org.uk, or known retailers in the markdown; otherwise fall back to journey trusted URL.',
  ]
  if (pi?.confidence) lines.push(`property_confidence: ${pi.confidence}`)
  if (ps?.epc_rating) lines.push(`epc_current_rating: ${ps.epc_rating}`)
  if (ps?.epc_stale) lines.push('epc_stale: true (lodgement over 10 years — treat fabric fields as indicative)')
  if (ps?.property_value_band) lines.push(`property_value_band: ${ps.property_value_band}`)
  if (ps?.flood_risk_zone) lines.push(`flood_risk_zone: ${ps.flood_risk_zone}`)
  if (ps?.solar_irradiance_kwh_m2 != null) {
    lines.push(`solar_irradiance_kwh_m2: ${ps.solar_irradiance_kwh_m2}`)
  }
  if (ps?.imd_decile != null) lines.push(`imd_decile: ${ps.imd_decile}`)
  if (ps?.dno_region) lines.push(`dno_region: ${ps.dno_region}`)
  return lines.join('\n')
}
