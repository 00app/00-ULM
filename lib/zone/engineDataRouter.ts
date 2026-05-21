/**
 * Hybrid data pipeline — free open-data anchors + deterministic £/kg, then capped premium editorial.
 * Math and structure are free; raw scrape + LLM prose are premium-only.
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
import type { OpenEpcProfile } from '@/lib/intelligence/openEpcClient'
import type { NesoGridSnapshot } from '@/lib/intelligence/nesoGridClient'
import {
  runPremiumEditorialExtraction,
  persistPremiumEditorialRow,
  type PremiumEditorialInput,
} from '@/lib/agents/premiumEditorialExtraction'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { buildDiscoveryInjectionId, buildDiscoveryInjectionCardAsync } from '@/lib/zone/discoveryCard'
import { validateInjectionCard } from '@/lib/zone/injections'
import { enforceHeadlineWordLimits, headlineFromTitle } from '@/lib/soloFocusCopy'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { isBucketFailoverMode } from '@/lib/intelligence/scrapeBoundaries'

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

function isHybridPipelineEnabled(): boolean {
  if (isBucketFailoverMode()) return true
  const v = process.env.HYBRID_DATA_PIPELINE?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
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
    const intensity = params.grid?.intensityG ?? 180
    carbonKg = Math.floor(carbonKg * (intensity / 180))
    if (a.toUpperCase() === 'NONE' || a.toUpperCase() === 'GAS') {
      moneyGbp = Math.max(moneyGbp, Math.floor(210 * mult))
      carbonKg = Math.max(carbonKg, Math.floor(420 * (intensity / 100)))
    }
  }

  if (j === 'solar') {
    const solarPct = params.grid?.generationMix?.solarPercentage ?? 1
    moneyGbp = Math.max(moneyGbp, Math.floor(450 * Math.max(0.85, solarPct)))
    carbonKg = Math.max(carbonKg, 610)
  }

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

  const anchor = await hydrateFreeStructuralContext(pc)
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
  let expandedHeadline = enforceHeadlineWordLimits(headlineFromTitle(rec.headline, 12), true)
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
