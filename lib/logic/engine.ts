/**
 * v21.0 logic engine — economic truth, regional grid tiers, audit placeholders.
 * British English in user-facing strings. UI shells consume labels via `ENGINE_UI_LABELS`.
 */

import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import type { JourneyId } from '@/lib/journeys'
import { fetchLivingPulseSnapshot } from '@/lib/logic/pulse'
import { getLocalData } from '@/lib/local/getLocalData'
import { compactAuditValue } from '@/lib/format'
import {
  APRIL_2026_TRUTH_PENCE,
  REG_GB_BASE_G_PER_KWH,
  REG_HI_RURAL_G_PER_KWH,
  REG_URBAN_LEZ_G_PER_KWH,
  TRUTH_2026_MARCH,
} from '@/lib/brains/constants'

export {
  APRIL_2026_TRUTH_PENCE,
  REG_GB_BASE_G_PER_KWH,
  REG_HI_RURAL_G_PER_KWH,
  REG_URBAN_LEZ_G_PER_KWH,
  TRUTH_2026_MARCH,
  MARCH_2026_ECONOMY,
  PRICE_CAP_SOURCE_URL,
  PRICE_CAP_SOURCE_LABEL,
} from '@/lib/brains/constants'

/** April 2026 typical household cap (£/yr) — single engine export for calculators. */
export const ENGINE_PRICE_CAP_TYPICAL_GBP = TRUTH_2026_MARCH.APRIL_PRICE_CAP_TYPICAL_GBP

/** Zone hero + settings — profile/journey-answer waste (not “potential”; that’s Zone welcome). */
export const ENGINE_UI_LABELS = {
  profileWasteMoney: 'Waste',
  profileWasteCarbon: 'Carbon',
  /** Zone tip / discovery cards — per-journey savings (not profile waste totals). */
  potentialSavings: 'Save',
  carbon: 'Carbon',
} as const

/** Template tokens for Mother copy — filled by callers or left visible as audit shell. */
export const ENGINE_AUDIT_TOKENS = {
  AUDIT_HEADLINE: '{AUDIT_HEADLINE}',
  AUDIT_VALUE: '{AUDIT_VALUE}',
  REGION_NAME: '{REGION_NAME}',
} as const

export type GridTier = 'REG_HI_RURAL' | 'REG_URBAN_LEZ' | 'REG_GB_BASE'

/** Highlands / islands outward codes vs standard GB vs urban LEZ heuristics. */
export function deriveGridTier(postcode: string, local: LocalIntelligence | null): GridTier {
  const compact = postcode.replace(/\s+/g, '').toUpperCase()
  if (/^(KW|IV|HS|ZE|PH)/.test(compact)) return 'REG_HI_RURAL'
  const region = String(local?.region ?? '').toLowerCase()
  const council = String(local?.council ?? '').toLowerCase()
  if (region.includes('london') || council.includes('manchester') || council.includes('birmingham')) {
    return 'REG_URBAN_LEZ'
  }
  return 'REG_GB_BASE'
}

/** Reference grid intensity (gCO₂e/kWh) for the tier when live API value absent. */
export function resolveGridGPerKwhFromTier(tier: GridTier): number {
  if (tier === 'REG_HI_RURAL') return REG_HI_RURAL_G_PER_KWH
  if (tier === 'REG_URBAN_LEZ') return REG_URBAN_LEZ_G_PER_KWH
  return REG_GB_BASE_G_PER_KWH
}

/**
 * Live or reference carbon intensity (gCO₂e/kWh) for the household postcode context.
 * Prefer Postcodes.io + Carbon Intensity API value when present.
 */
export function getCarbonIntensity(postcode: string, local: LocalIntelligence | null): number {
  const tier = deriveGridTier(postcode, local)
  const live = local?.localCarbonG
  if (typeof live === 'number' && Number.isFinite(live) && live > 0) return live
  return resolveGridGPerKwhFromTier(tier)
}

export interface PotentialSavingsInput {
  postcode: string
  /** Optional baseline annual £ from impact layer — stub scales lightly by region tier. */
  baselineAnnualGbp?: number
}

/**
 * Optimised potential-savings stub — deterministic until wired to full impact graph.
 * Returns whole pounds for display stacks.
 */
export function getPotentialSavings(input: PotentialSavingsInput): { gbp: number; note: string } {
  const tier = deriveGridTier(input.postcode, null)
  const tierBoost = tier === 'REG_HI_RURAL' ? 1.08 : tier === 'REG_URBAN_LEZ' ? 1.04 : 1
  const base = typeof input.baselineAnnualGbp === 'number' && Number.isFinite(input.baselineAnnualGbp)
    ? Math.max(0, input.baselineAnnualGbp)
    : 0
  const gbp = Math.round(base * tierBoost)
  return {
    gbp,
    note: 'Potential savings are indicative until the full impact model runs.',
  }
}

export async function getApril2026Economy(
  postcode: string,
  local: LocalIntelligence | null
): Promise<{
  capGbp: number
  elecPencePerKwh: number
  gasPencePerKwh: number
}> {
  const pulse = await fetchLivingPulseSnapshot(postcode, local)
  if (pulse.source === 'fallback') console.warn('[engine] getApril2026Economy fallback')
  return {
    capGbp: pulse.priceCapGbp,
    elecPencePerKwh: pulse.electricityPPerKwh,
    gasPencePerKwh: pulse.gasPPerKwh,
  }
}

export async function getCurrentElectricityRate(
  postcode: string,
  local: LocalIntelligence | null
): Promise<number> {
  const pulse = await fetchLivingPulseSnapshot(postcode, local)
  if (pulse.source === 'fallback') console.warn('[engine] getCurrentElectricityRate fallback')
  return pulse.electricityPPerKwh
}

export async function getCurrentGasRate(
  postcode: string,
  local: LocalIntelligence | null
): Promise<number> {
  const pulse = await fetchLivingPulseSnapshot(postcode, local)
  if (pulse.source === 'fallback') console.warn('[engine] getCurrentGasRate fallback')
  return pulse.gasPPerKwh
}

export async function getCurrentPriceCap(
  postcode: string,
  local: LocalIntelligence | null
): Promise<number> {
  const pulse = await fetchLivingPulseSnapshot(postcode, local)
  if (pulse.source === 'fallback') console.warn('[engine] getCurrentPriceCap fallback')
  return pulse.priceCapGbp
}

type EngineProfileInput = {
  name?: string
  postcode?: string
  livingSituation?: string
  homeType?: string
  transport?: string
  age?: string
  employmentStatus?: string
  tenure?: string
  householdSize?: number
} | null | undefined

/**
 * Clean-calculator wrapper over the single source of truth (`buildUserImpact`).
 * Returns annualised Potential Savings (£) and Carbon (kg).
 */
export function calculatePotentialSavings(
  profile: EngineProfileInput,
  journeyAnswers: Record<string, Record<string, string>>
): { savings: number; carbon: number } {
  const impact = buildUserImpact({
    profile: {
      name: profile?.name,
      postcode: profile?.postcode,
      household: profile?.livingSituation,
      home_type: profile?.homeType,
      transport_baseline: profile?.transport,
    },
    journeyAnswers: journeyAnswers as Record<JourneyId, Record<string, string>>,
  })
  return {
    savings: Math.max(0, impact.totals.totalMoney),
    carbon: Math.max(0, impact.totals.totalCarbon),
  }
}

export function compactAuditEconomy(args: { savingsGbp: number; carbonKg: number }): {
  potential_saving: string
  carbon_offset: string
} {
  const money = compactAuditValue(args.savingsGbp, 'money')
  const carbon = compactAuditValue(args.carbonKg, 'carbon')
  return {
    potential_saving: `£${money.figure}${money.suffix ?? ''}`,
    carbon_offset: `${carbon.figure}${carbon.suffix ?? ''}`,
  }
}

/** Regional carbon accessor for UI hooks. */
export function getRegionalCarbonIntensity(postcode: string, local: LocalIntelligence | null = null): number {
  return getCarbonIntensity(postcode, local)
}

export async function getAuditorContext(postcode: string): Promise<{
  regionName: string
  localityName: string
  gridIntensityGPerKwh: number
  economyTier: GridTier
}> {
  const local = await getLocalData(postcode)
  const reverseApi = process.env.REVERSE_GEOCODING_API?.trim()
  let reverseLocality: string | null = null
  if (reverseApi) {
    try {
      const res = await fetch(
        `${reverseApi.replace(/\/$/, '')}?postcode=${encodeURIComponent(postcode.replace(/\s+/g, '').toUpperCase())}`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
      )
      if (res.ok) {
        const json = (await res.json()) as { locality?: string; city?: string; town?: string }
        reverseLocality = json.locality ?? json.city ?? json.town ?? null
      }
    } catch {
      // keep LocalIntelligence fallback
    }
  }
  const tier = deriveGridTier(postcode, local)
  const localityName = reverseLocality ?? local?.locality ?? local?.council ?? compactPostcode(postcode)
  const regionName = local?.region ?? localityName
  return {
    regionName,
    localityName,
    gridIntensityGPerKwh: getCarbonIntensity(postcode, local),
    economyTier: tier,
  }
}

function compactPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').toUpperCase()
}

export interface AuditBaselineCopyInput {
  locality: string
  postcode: string
  gridTier: GridTier
  gridGPerKwh: number
  elecPence: number
  gasPence: number
  capGbp: number
  groundedNarrative: string
  offerLabel: string
  offerAmountGbp: number
  sourceLabel: string
}

/** Clean-shell Mother baseline: Audit headline + tokenised body for future wiring. */
export function buildAuditBaselineMotherCopy(input: AuditBaselineCopyInput): { heading: string; description: string } {
  const region = input.locality.trim() || input.postcode
  const desc = [
    `${ENGINE_AUDIT_TOKENS.AUDIT_HEADLINE}`,
    `${ENGINE_AUDIT_TOKENS.AUDIT_VALUE}: £${Math.round(input.offerAmountGbp).toLocaleString('en-GB')} (${input.offerLabel})`,
    `${ENGINE_AUDIT_TOKENS.REGION_NAME}: ${region}`,
    `April 2026 reference unit rates: electricity ${input.elecPence}p/kWh, gas ${input.gasPence}p/kWh, typical cap £${input.capGbp.toLocaleString('en-GB')}.`,
    `Grid tier ${input.gridTier} — reference intensity ${input.gridGPerKwh} gCO₂e/kWh.`,
    input.groundedNarrative,
    `Live Data: ${input.sourceLabel} | Grounded: April 27, 2026.`,
  ].join('\n\n')

  return {
    heading: 'Audit',
    description: desc,
  }
}
