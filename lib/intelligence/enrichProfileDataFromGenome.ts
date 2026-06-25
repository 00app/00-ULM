/**
 * Merge user_genome.property_intelligence into research profile payloads.
 */

import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import type { JourneyId } from '@/lib/journeys'
import {
  buildAnswerFunnel,
  buildPropertyResearchSignals,
  type AnswerFunnelResult,
} from '@/lib/intelligence/answerFunnelRouter'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import type { LocalizedProfileInput } from '@/lib/intelligence/researchProfilePayload'

export function readPropertyIntelligenceFromGenome(
  genome: Record<string, unknown> | null | undefined
): PropertyIntelligence | null {
  const raw = genome?.property_intelligence
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const pi = raw as PropertyIntelligence
  if (!pi.confidence || !pi.enrichedAt) return null
  return pi
}

export function enrichLocalizedProfileFromGenome(
  base: LocalizedProfileInput,
  genome?: Record<string, unknown> | null
): LocalizedProfileInput {
  const pi = readPropertyIntelligenceFromGenome(genome ?? null)
  const imdFromGenome = genome?.imd_decile
  const withImd =
    typeof imdFromGenome === 'number' && Number.isFinite(imdFromGenome)
      ? { ...base, imd_decile: Math.round(imdFromGenome) }
      : base
  return buildPropertyResearchSignals(withImd, pi)
}

function localizedSignalsToResearchProfile(
  signals: LocalizedProfileInput
): ResearchProfileData {
  const out: ResearchProfileData = {}
  const copy = (key: keyof LocalizedProfileInput, target?: string) => {
    const v = signals[key]
    if (v == null || v === '') return
    if (typeof v === 'boolean') {
      out[target ?? key] = v ? 'true' : 'false'
      return
    }
    if (typeof v === 'number') {
      out[target ?? key] = String(v)
      return
    }
    out[target ?? key] = String(v)
  }
  copy('postcode')
  copy('home_type')
  copy('home_power')
  copy('household')
  copy('transport_baseline')
  copy('heating')
  copy('employment_status')
  copy('household_income_bracket')
  copy('tenure')
  copy('household_size')
  copy('goal')
  copy('primary_goal')
  copy('house_number')
  copy('property_confidence')
  copy('epc_rating')
  copy('epc_potential_rating')
  copy('epc_stale')
  copy('property_value_band')
  copy('flood_risk_zone')
  copy('solar_irradiance_kwh_m2')
  copy('dno_region')
  copy('lsoa_code')
  copy('imd_decile')
  return out
}

export function enrichResearchProfileFromSession(
  base: ResearchProfileData,
  session?: { user_genome?: Record<string, unknown> | null } | null
): ResearchProfileData {
  const signals = enrichLocalizedProfileFromGenome(
    {
      postcode: base.postcode,
      home_type: base.home_type,
      home_power: base.home_power,
      household: base.household,
      transport_baseline: base.transport_baseline,
      heating: base.heating,
      employment_status: base.employment_status,
      household_income_bracket: base.household_income_bracket,
      tenure: base.tenure,
      household_size: base.household_size,
      goal: base.goal,
      primary_goal: base.primary_goal,
      house_number: base.house_number,
    },
    session?.user_genome
  )
  return { ...base, ...localizedSignalsToResearchProfile(signals) }
}

export function mergeFunnelIntoResearchProfile(
  base: ResearchProfileData | LocalizedProfileInput,
  funnel: AnswerFunnelResult
): ResearchProfileData {
  return {
    ...(typeof base.postcode === 'string' ? { postcode: base.postcode } : {}),
    ...localizedSignalsToResearchProfile(funnel.profileSignals),
    ...('hermes_skill_file' in base && base.hermes_skill_file
      ? { hermes_skill_file: base.hermes_skill_file }
      : {}),
  }
}

/** ResearchProfileData (flat strings) + optional genome PI → funnel for Firecrawl/Gemini. */
export function buildAnswerFunnelFromResearchProfile(
  profileData: ResearchProfileData | null | undefined,
  opts?: {
    propertyIntelligence?: PropertyIntelligence | null
    genome?: Record<string, unknown> | null
    activeJourneyId?: JourneyId | null
    journeyAnswers?: Partial<Record<JourneyId, Record<string, string>>>
  }
): AnswerFunnelResult {
  const pi =
    opts?.propertyIntelligence ?? readPropertyIntelligenceFromGenome(opts?.genome ?? null)
  const imdRaw = profileData?.imd_decile
  const imdParsed =
    typeof imdRaw === 'string' && imdRaw.trim() ? Number(imdRaw) : Number.NaN
  const profile = enrichLocalizedProfileFromGenome(
    {
      postcode: profileData?.postcode,
      home_type: profileData?.home_type,
      home_power: profileData?.home_power,
      household: profileData?.household,
      transport_baseline: profileData?.transport_baseline,
      heating: profileData?.heating,
      employment_status: profileData?.employment_status,
      household_income_bracket: profileData?.household_income_bracket,
      tenure: profileData?.tenure,
      household_size: profileData?.household_size,
      goal: profileData?.goal,
      primary_goal: profileData?.primary_goal,
      house_number: profileData?.house_number,
      imd_decile: Number.isFinite(imdParsed) ? Math.round(imdParsed) : pi?.deprivation?.imdDecile,
    },
    opts?.genome
  )
  return buildAnswerFunnel({
    profile,
    propertyIntelligence: pi,
    journeyAnswers: opts?.journeyAnswers,
    activeJourneyId: opts?.activeJourneyId ?? null,
  })
}
