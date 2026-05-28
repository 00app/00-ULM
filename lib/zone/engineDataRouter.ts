/**
 * Hybrid data pipeline — free open-data anchors + deterministic £/kg, then capped premium editorial.
 * Math and structure are free; raw scrape + LLM prose are premium-only.
 *
 * Structural reference (12k/1t): {@link ULM_KWH_PER_TONNE_CO2E} kWh ↔ 1 t CO₂e per auditor matrix.
 */

import type { JourneyId } from '@/lib/journeys'
import { isValidJourneyId } from '@/lib/journeys'
import {
  estimateDiscoveryCarbonKg,
  ukAverageSavingForDiscoveryAnswer,
} from '@/lib/brains/calculations'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { formatCarbon, formatZoneCardMoney } from '@/lib/format'
import { hydrateFreeStructuralContext } from '@/lib/intelligence/freeTierHydration'
import { fetchOpendataEpcProfile, type OpenEpcProfile } from '@/lib/intelligence/openEpcClient'
import { fetchNesoGridIntensity, type NesoGridSnapshot } from '@/lib/intelligence/nesoGridClient'
import {
  isBucketFailoverMode,
  shouldSkipFirecrawlScrape,
} from '@/lib/intelligence/scrapeBoundaries'
import {
  runPremiumEditorialExtraction,
  persistPremiumEditorialRow,
  type PremiumEditorialInput,
} from '@/lib/agents/premiumEditorialExtraction'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { buildDiscoveryInjectionId, buildDiscoveryInjectionCardAsync } from '@/lib/zone/discoveryCard'
import { validateInjectionCard } from '@/lib/zone/injections'
import {
  enforceHeadlineWordLimits,
  headlineFromTitle,
  MAX_EXPANDED_VIEW_HEADLINE_WORDS,
} from '@/lib/soloFocusCopy'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { ULM_KWH_PER_TONNE_CO2E } from '@/lib/zone/ulmLimits'

/** 1 tonne CO₂e expressed as kg for card math. */
export const STRUCTURAL_KG_CO2E_PER_TONNE = 1_000

import { STRUCTURAL_REF_GRID_INTENSITY_G } from '@/lib/brains/liveGridCarbonFactor'

export interface HydrationPayload {
  userId: string
  postcode: string
  journeyKey: string
  questionId: string
  userAnswer: string
  profileData?: ResearchProfileData | null
}

export interface HybridLoopSpawnResult {
  moneyGbp: number
  carbonKg: number
  agentHeadline: string
  expandedHeadline: string
  architectProse: string
  offerUrl: string
  zoneCard: ZoneTipCard
  epc: OpenEpcProfile
  grid: NesoGridSnapshot | null
}

export interface StructuralPostcodeAnchor {
  postcode: string
  epc: OpenEpcProfile
  grid: NesoGridSnapshot | null
  /** `skip_firecrawl` = EPC + NESO only; `full_hydrate` = Tier A parallel bundle. */
  source: 'skip_firecrawl' | 'full_hydrate'
}

/** 12k/1t — convert annual kWh delta to kg CO₂e on the structural matrix. */
export function structuralKgCo2eFromKwh(kwh: number): number {
  if (!Number.isFinite(kwh) || kwh <= 0) return 0
  return Math.round((kwh / ULM_KWH_PER_TONNE_CO2E) * STRUCTURAL_KG_CO2E_PER_TONNE)
}

/** 12k/1t — convert kg CO₂e back to equivalent kWh on the structural matrix. */
export function structuralKwhFromKgCo2e(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0
  return Math.round((kg / STRUCTURAL_KG_CO2E_PER_TONNE) * ULM_KWH_PER_TONNE_CO2E)
}

/**
 * Snap kg CO₂e to the 12k/1t matrix (kWh ↔ kg equivalence) after journey-specific scaling.
 */
export function snapCarbonToStructuralMatrix(rawCarbonKg: number): number {
  return structuralKgCo2eFromKwh(structuralKwhFromKgCo2e(Math.max(0, rawCarbonKg)))
}

function isHybridPipelineEnabled(): boolean {
  if (shouldSkipFirecrawlScrape()) return true
  if (isBucketFailoverMode()) return true
  const v = process.env.HYBRID_DATA_PIPELINE?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * Free REST intercept — EPC + NESO from postcode string.
 * When SKIP_FIRECRAWL=1 (or no Firecrawl key), skips full Tier A bundle but still grounds £/kg.
 */
export async function resolveStructuralPostcodeAnchor(
  postcode: string
): Promise<StructuralPostcodeAnchor | null> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (compact.length < 4) return null

  if (shouldSkipFirecrawlScrape()) {
    const [epc, grid] = await Promise.all([
      fetchOpendataEpcProfile(compact),
      fetchNesoGridIntensity(compact),
    ])
    return { postcode: compact, epc, grid, source: 'skip_firecrawl' }
  }

  const anchor = await hydrateFreeStructuralContext(compact)
  if (!anchor) return null
  return {
    postcode: anchor.postcode,
    epc: anchor.epc,
    grid: anchor.grid,
    source: 'full_hydrate',
  }
}

function calculateDeterministicDeltas(params: {
  journeyKey: string
  questionId: string
  userAnswer: string
  epc: OpenEpcProfile
  grid: NesoGridSnapshot | null
}): { moneyGbp: number; carbonKg: number } {
  const j = params.journeyKey
  const q = params.questionId
  const a = String(params.userAnswer ?? '').trim()
  const benchmark = ukAverageSavingForDiscoveryAnswer(
    j as JourneyId,
    q,
    a
  )
  let moneyGbp = benchmark.gbp
  let carbonKg = estimateDiscoveryCarbonKg(j as JourneyId, q, a)

  if (j === 'home') {
    const mult = params.epc.currentThermalEfficiencyMultiplier
    moneyGbp = Math.floor(moneyGbp * mult)
    const intensity = params.grid?.intensityG ?? STRUCTURAL_REF_GRID_INTENSITY_G
    carbonKg = Math.floor(carbonKg * (intensity / STRUCTURAL_REF_GRID_INTENSITY_G))
    if (a.toUpperCase() === 'NONE' || a.toUpperCase() === 'GAS') {
      moneyGbp = Math.max(moneyGbp, Math.floor(210 * mult))
      carbonKg = Math.max(carbonKg, Math.floor(420 * (intensity / 100)))
    }
  }

  if (j === 'solar') {
    const solarPct = params.grid?.generationMix?.solarPercentage ?? 1
    moneyGbp = Math.max(moneyGbp, Math.floor(450 * Math.max(0.85, solarPct)))
    carbonKg = Math.max(carbonKg, structuralKgCo2eFromKwh(structuralKwhFromKgCo2e(610)))
  }

  carbonKg = snapCarbonToStructuralMatrix(carbonKg)

  return {
    moneyGbp: Math.max(0, Math.round(moneyGbp)),
    carbonKg: Math.max(0, Math.round(carbonKg)),
  }
}

/**
 * Tier C spawn — one answer → one discovery card; premium editorial optional when Gemini is set.
 */
export async function processCalculatedLoopSpawn(
  payload: HydrationPayload
): Promise<HybridLoopSpawnResult | null> {
  if (!isHybridPipelineEnabled()) return null
  if (!isValidJourneyId(payload.journeyKey)) return null

  const pc = payload.postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 4) return null

  const anchor = await resolveStructuralPostcodeAnchor(pc)
  if (!anchor) return null

  const { moneyGbp, carbonKg } = calculateDeterministicDeltas({
    journeyKey: payload.journeyKey,
    questionId: payload.questionId,
    userAnswer: payload.userAnswer,
    epc: anchor.epc,
    grid: anchor.grid,
  })

  const journeyId = payload.journeyKey as JourneyId
  const rec = getDiscoveryRecommendation(journeyId, payload.questionId, payload.userAnswer)
  const stableId = buildDiscoveryInjectionId(
    journeyId,
    payload.questionId,
    payload.userAnswer
  )

  const editorialInput: PremiumEditorialInput = {
    postcode: pc,
    category: payload.journeyKey,
    factualMoneyValue: moneyGbp,
    factualCarbonValue: carbonKg,
    buildingPhysics: anchor.epc.description,
    profileData: payload.profileData ?? null,
    userId: payload.userId,
    offerUrlHint: rec.learnUrl,
  }

  let agentHeadline = enforceHeadlineWordLimits(rec.headline, false)
  let expandedHeadline = enforceHeadlineWordLimits(
    headlineFromTitle(rec.headline, MAX_EXPANDED_VIEW_HEADLINE_WORDS),
    true
  )
  let architectProse = rec.body
  let offerUrl = rec.learnUrl

  const editorial = await runPremiumEditorialExtraction(editorialInput)
  if (editorial) {
    agentHeadline = enforceHeadlineWordLimits(editorial.agentHeadline, false)
    expandedHeadline = enforceHeadlineWordLimits(editorial.agentHeadline, true)
    architectProse = editorial.architectProse
    offerUrl = editorial.offerUrl
    void persistPremiumEditorialRow(editorialInput, editorial)
  }

  const fallback = await buildDiscoveryInjectionCardAsync(
    journeyId,
    payload.questionId,
    payload.userAnswer,
    stableId
  )
  if (!fallback) return null

  const raw = {
    ...fallback,
    id: stableId,
    title: agentHeadline,
    data: {
      money: formatZoneCardMoney(moneyGbp),
      carbon: formatCarbon(carbonKg),
    },
    source: offerUrl,
    explanation: architectProse.includes('\n\n')
      ? architectProse.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 3)
      : [architectProse, rec.body].filter(Boolean),
    cta: { label: rec.ctaLabel, url: rec.ctaUrl ?? offerUrl },
  }

  const zoneCard = validateInjectionCard(raw)
  if (!zoneCard) return null

  return {
    moneyGbp,
    carbonKg,
    agentHeadline,
    expandedHeadline,
    architectProse,
    offerUrl,
    zoneCard,
    epc: anchor.epc,
    grid: anchor.grid,
  }
}
