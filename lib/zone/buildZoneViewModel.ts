// Locked Zone view model builder
// Data flow: Profile + Journey Answers → buildUserImpact → Zone View Model
// NO calculations here — all £/kg from buildUserImpact.
//
// v1.8.12 Content Architect: sync `architectSuppliedBy` on every journey/general/tip row via
// `defaultVerifiedArchitectSuppliedBy`. Async three-paragraph prose from Gemini: client POSTs
// `buildContentArchitectCardPayload(vm, …)` → `/api/zone/content-architect` → `applyArchitectEnrichment`.

import { JourneyId, JOURNEY_ORDER } from '@/lib/journeys'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import type { ImpactProfile, Persona } from '@/lib/brains/types'
import { normalizeEmploymentStatus, type ImpactResult } from '@/lib/brains/calculations'
import type { ScrapedOverlayResult } from '@/lib/brains/buildUserImpact'
import type { ScrapedDataPoint } from '@/lib/scraper/sources'
import { formatCarbon, formatZoneCardMoney } from '@/lib/format'
import { defaultVerifiedArchitectSuppliedBy } from '@/lib/soloFocusSuppliedBy'
import { getJourneySource, formatSourceLabel } from '@/lib/content/sources'
import { PRICE_CAP_APRIL_2026, PRICE_CAP_SOURCE_URL, PRICE_CAP_SOURCE_LABEL } from '@/lib/brains/constants'
import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'
import { buildAuditorNarrativeParagraphs } from '@/lib/zone/auditorNarrative'
import {
  VERIFIED_SOURCE_DATE,
  resolvePartnerLink,
  formatVerifiedSourceNameFromLabel,
} from '@/lib/zone/verifiedRevenue'

/** Split Neon `architect_prose` into three Trinity blocks. */
function trinityExplanationFromArchitectProse(prose: string | null | undefined): string[] | null {
  const t = prose?.trim()
  if (!t) return null
  const parts = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 3) return parts.slice(0, 3)
  return null
}

export type NeonJourneyResearchRow = {
  savingGbp: number
  architectProse: string | null
}

export interface ZoneHero {
  id: string
  variant: 'card-hero'
  title: string
  journey_key?: JourneyId
  category?: JourneyId
  data: { carbon: string; money: string }
  source?: string
  sourceLabel?: string
  /** v35.0 verified citation + revenue handoff */
  source_name?: string
  source_date?: string
  partner_link?: string
  explanation?: string[]
  actions?: {
    actionType: 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view'
    learnUrl: string   // source URL — LEARN always uses this
    actionUrl?: string // provider URL — ACTION uses this when present
  }
}

export interface ZoneJourneyCard {
  id: string
  variant: 'card-standard'
  title: string
  journey_key: JourneyId
  category: JourneyId
  data: { carbon: string; money: string }
  /** Numeric for Economic-First lead logic (money vs carbon hook) */
  carbonKg?: number
  moneyGbp?: number
  source?: string
  sourceLabel?: string
  explanation?: string[]
  actions?: {
    actionType: 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view'
    learnUrl: string
    actionUrl?: string
  }
  /** S UPDATE: from scraped overlay; show in .deep-content / scraped-insight-tag */
  insightLabel?: string
  /** S UPDATE: when true, card gets 1px solid var(--color-purple) Insight Alert border */
  insightAlert?: boolean
  /** S UPDATE: when true, .text-data can use counting animation on first view */
  fromScraper?: boolean
  /** Local Living: council-specific tip (e.g. "Warm Homes Local Grant in [Council]") */
  localCouncilTip?: string
  /** v1.3: council + local grid intensity for expanded card (punchy Roboto text). */
  localContextBar?: string
  /** S Update: "Claim Offer" deep-link (GOV.UK or council application). */
  claimOfferUrl?: string
  /** S Update: Warm Homes / priority eligible → pulsing gold border. */
  isPriorityAlert?: boolean
  /** True Card: dynamic CTA and follow-up (when card comes from discovery pipeline). */
  cta?: { label: string; url: string }
  followUp?: { question: string; options: string[]; targetField: string }
  /** Content Architect (Gemini): verified attribution short name, e.g. GOV.UK */
  architectSuppliedBy?: string
  /** Content Architect: imperative HOW line (Solo Focus). */
  architectActionLine?: string
  /** v35.0 — traceable source + revenue link */
  source_name?: string
  source_date?: string
  partner_link?: string
  /** v41.1 audit state when genome data is incomplete */
  auditState?: 'LIVE_AUDIT' | 'ESTIMATED_AUDIT'
}

export interface ZoneTipCard {
  id: string
  variant: 'card-compact'
  title: string
  journey_key: JourneyId
  category: JourneyId
  data: { carbon: string; money: string }
  source?: string
  sourceLabel?: string
  explanation?: string[]
  actions?: {
    actionType: 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view'
    learnUrl: string
    actionUrl?: string
  }
  /** True Card schema: LocalTip only shown when location matches user area */
  type?: 'NationalOffer' | 'LocalTip'
  location?: string
  /** Dynamic CTA (e.g. "Get this Saving", "Check My Eligibility") */
  cta?: { label: string; url: string }
  /** Card-to-question loop for Expanded View */
  followUp?: { question: string; options: string[]; targetField: string }
  /** ZeroHunter urgency / policy window (e.g. pre–April 1 ECO4 messaging) */
  badge?: string
  /** Semantic win signal from discovery pipeline: drives money/carbon emphasis. */
  dominant_win?: 'money' | 'carbon'
  /** Action Vault rebirth — high-signal Solo Focus / Zone inject. */
  high_impact?: boolean
  /** Verified short attribution (sync + Content Architect). */
  architectSuppliedBy?: string
  /** v35.0 — traceable source + revenue link */
  source_name?: string
  source_date?: string
  partner_link?: string
  /** v41.1 audit state when genome data is incomplete */
  auditState?: 'LIVE_AUDIT' | 'ESTIMATED_AUDIT'
}

export interface ZoneViewModel {
  hero: ZoneHero
  journeys: ZoneJourneyCard[]
  tips: ZoneTipCard[]
}

// Journey-specific recommendation titles (deterministic)
const JOURNEY_TITLES: Record<JourneyId, string> = {
  home: 'reduce home energy costs',
  travel: 'cut travel emissions',
  food: 'lower food footprint',
  shopping: 'buy less, save more',
  money: 'optimise monthly spending',
  carbon: 'track and reduce carbon',
  tech: 'keep devices longer',
  waste: 'reduce household waste',
  holidays: 'travel smarter on holiday',
}

// General card titles from profile (livingSituation / household, homeType / home_type, transport / transport_baseline)
function getGeneralCardTitles(profile?: {
  household?: string
  home_type?: string
  transport_baseline?: string
}): { homeLiving: string; transport: string; homeExtra: string } {
  const ht = profile?.home_type?.toUpperCase()
  const hh = profile?.household?.toUpperCase()
  const tr = profile?.transport_baseline?.toUpperCase()

  const homeLiving =
    ht === 'FLAT'
      ? 'optimise your flat energy use'
      : ht === 'HOUSE'
        ? 'reduce household energy costs'
        : hh === 'ALONE'
          ? 'save on home energy'
          : hh === 'FAMILY'
            ? 'cut family home emissions'
            : 'save on home energy'

  const transport =
    tr === 'CAR'
      ? 'cut travel emissions'
      : tr === 'WALK' || tr === 'BIKE'
        ? 'keep travel green'
        : tr === 'PUBLIC'
          ? 'maintain low-carbon travel'
          : tr === 'MIX'
            ? 'optimise how you get around'
            : 'improve your travel footprint'

  const homeExtra =
    ht === 'HOUSE'
      ? 'save on household bills'
      : ht === 'FLAT'
        ? 'lower your flat bills'
        : 'improve home efficiency'

  return { homeLiving, transport, homeExtra }
}

// Re-export getJourneyImpact from buildUserImpact (single source of truth)
export { getJourneyImpact } from '@/lib/brains/buildUserImpact'

/** Age persona: tips bias Junior → tech/food, Retired → home/holidays */
type ProfileAge = 'JUNIOR' | 'MID' | 'RETIRED'

function norm(v?: string): string {
  return (v ?? '').trim().toUpperCase()
}

function outwardFromPostcode(postcode?: string): string {
  const compact = (postcode ?? '').replace(/\s+/g, '').toUpperCase()
  const m = compact.match(/^[A-Z]{1,2}\d[A-Z\d]?/)
  return m?.[0] ?? (compact.slice(0, 4) || 'LOCAL AREA')
}

function isGenericHomepageUrl(url?: string): boolean {
  if (!url) return true
  try {
    const u = new URL(url)
    return u.pathname === '/' || u.pathname === ''
  } catch {
    return true
  }
}

function buildZaiAuditDeepLink(params: {
  journey: JourneyId
  title: string
  moneyGbp: number
  carbonKg: number
  locality: string
}): string {
  const q = new URLSearchParams({
    context: 'manual_audit',
    topic: params.journey,
    journey: params.journey,
    title: params.title,
    money: String(Math.max(0, Math.round(params.moneyGbp))),
    carbon: String(Math.max(0, Math.round(params.carbonKg))),
    locality: params.locality,
  })
  return `/zai?${q.toString()}`
}

function reasonForJourney(journey: JourneyId, journeyAnswers: Record<JourneyId, Record<string, string>>): string {
  const home = journeyAnswers.home ?? {}
  const travel = journeyAnswers.travel ?? {}
  const fuel = norm(travel.fuel_type)
  const tenure = norm(home.tenure ?? home.housing_tenure)
  switch (journey) {
    case 'home':
      return tenure === 'RENT' || tenure === 'RENTER' ? 'RENTAL EFFICIENCY LEAK' : 'HEATING EFFICIENCY LEAK'
    case 'travel':
      return fuel === 'PETROL' || fuel === 'DIESEL' ? 'FUEL-COST PRESSURE' : 'COMMUTE LEAK'
    case 'food':
      return 'FOOD WASTE LEAK'
    case 'shopping':
      return 'PURCHASE CYCLE LEAK'
    case 'money':
      return 'MONTHLY SPEND DRIFT'
    case 'carbon':
      return 'GRID TIMING LEAK'
    case 'tech':
      return 'STANDBY POWER LEAK'
    case 'waste':
      return 'DISPOSAL COST LEAK'
    case 'holidays':
      return 'TRAVEL MODE LEAK'
    default:
      return 'SAVINGS LEAK'
  }
}

function buildCompactHeadline(params: {
  journey: JourneyId
  moneyGbp: number
  journeyAnswers: Record<JourneyId, Record<string, string>>
}): string {
  const reason = reasonForJourney(params.journey, params.journeyAnswers)
  switch (params.journey) {
    case 'tech':
      return 'KILL STANDBY WASTE — TECH AUDIT'
    case 'holidays':
      return 'OPTIMIZE TRAVEL — HOLIDAY SAVING'
    case 'home':
      return 'CUT HOME COST LEAKS — ENERGY AUDIT'
    case 'travel':
      return 'TRIM COMMUTE SPEND — TRAVEL AUDIT'
    case 'food':
      return 'CUT FOOD WASTE — KITCHEN AUDIT'
    case 'shopping':
      return 'SLOW BUY CYCLE — SHOPPING AUDIT'
    case 'money':
      return 'STABILIZE MONTHLY BILLS — MONEY AUDIT'
    case 'carbon':
      return 'LOWER GRID LOAD — CARBON AUDIT'
    case 'waste':
      return 'SHRINK BIN LEAKS — WASTE AUDIT'
    default:
      return `${reason} — ACTION AUDIT`
  }
}

function teaserTitleFromOffer(input?: string | null): string | null {
  if (!input) return null
  const clean = input
    .replace(/\s+/g, ' ')
    .replace(/^source\.\s*/i, '')
    .trim()
  if (!clean) return null
  const firstSentence = clean.split(/[.!?]/)[0]?.trim() ?? clean
  if (firstSentence.length < 12) return null
  const words = firstSentence.split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const clipped = words.slice(0, 8).join(' ')
  return `${clipped.toUpperCase()}${words.length > 8 ? '...' : ''}`
}

function profileDrivenJourneyTitle(
  journeyKey: JourneyId,
  profile: {
    household?: string
    home_type?: string
    transport_baseline?: string
    age?: ProfileAge | string
    employment_status?: string
    goal?: string
  } | undefined,
  journeyAnswers: Record<JourneyId, Record<string, string>>
): string {
  const home = journeyAnswers.home ?? {}
  const travel = journeyAnswers.travel ?? {}
  const homeType = norm(profile?.home_type)
  const household = norm(profile?.household)
  const transport = norm(profile?.transport_baseline)
  const age = norm(typeof profile?.age === 'string' ? profile.age : undefined)
  const employment = norm(profile?.employment_status)
  const tenure = norm(home.tenure ?? home.housing_tenure)
  const fuel = norm(travel.fuel_type)

  switch (journeyKey) {
    case 'home':
      if (homeType === 'FLAT') return 'lower flat energy spend'
      if (tenure === 'RENT' || tenure === 'RENTER') return 'cut bills as a renter'
      return 'reduce home energy costs'
    case 'travel':
      if (transport === 'CAR' && fuel === 'PETROL') return 'cut petrol travel costs'
      if (transport === 'CAR' && fuel === 'DIESEL') return 'cut diesel travel costs'
      if (transport === 'PUBLIC') return 'lower commute travel impact'
      return 'cut travel emissions'
    case 'food':
      if (household === 'FAMILY') return 'cut family food waste'
      return 'lower food footprint'
    case 'shopping':
      return profile?.goal === 'money' ? 'buy less, save more' : 'shop with lower impact'
    case 'money':
      if (employment === 'SELF_EMPLOYED') return 'optimise monthly cash flow'
      if (employment === 'UNEMPLOYED') return 'protect monthly essentials'
      return 'optimise monthly spending'
    case 'carbon':
      return profile?.goal === 'money' ? 'track carbon while saving' : 'track and reduce carbon'
    case 'tech':
      if (age === 'JUNIOR') return 'make devices last longer'
      return 'keep devices longer'
    case 'waste':
      return 'reduce household waste'
    case 'holidays':
      return transport === 'PUBLIC' ? 'plan lower-impact breaks' : 'travel smarter on holiday'
    default:
      return JOURNEY_TITLES[journeyKey]
  }
}

function mergeDiscoveryInjectionsIntoTips(staticTips: ZoneTipCard[], injected?: ZoneTipCard[], goal?: string): ZoneTipCard[] {
  if (!injected?.length) return staticTips.slice(0, 3)
  
  // Sort injected tips based on goal
  const sortedInjected = [...injected]
  if (goal === 'money') {
    sortedInjected.sort((a, b) => {
      const aMoney = parseFloat(a.data?.money?.replace(/[^\d.]/g, '') || '0')
      const bMoney = parseFloat(b.data?.money?.replace(/[^\d.]/g, '') || '0')
      return bMoney - aMoney
    })
  } else if (goal === 'carbon') {
    sortedInjected.sort((a, b) => {
      const aCarbon = parseFloat(a.data?.carbon?.replace(/[^\d.]/g, '') || '0')
      const bCarbon = parseFloat(b.data?.carbon?.replace(/[^\d.]/g, '') || '0')
      return bCarbon - aCarbon
    })
  }

  const topInjected = sortedInjected.slice(0, 3)
  const usedJourneys = new Set(topInjected.map((i) => i.journey_key))
  const rest = staticTips.filter((t) => !usedJourneys.has(t.journey_key))
  return [...topInjected, ...rest].slice(0, 3)
}

type MarketContext = {
  liveProfilePostcode?: string
  april2026PriceCapGbp?: number
  regionalGridIntensityGPerKwh?: number
  liveResearchData?: boolean
  deepLink?: string
  verifiedSaving?: number
  /** From `research_results.saving_amount_gbp` (scrape-sync). */
  savingAmountGbp?: number
  localityContext?: string
  /** Neon-backed £/kWh (or April 2026 constants fallback) — same source as `/api/summary`. */
  homeUnitRates?: { elecGbpPerKwh: number; gasGbpPerKwh: number }
}

function getGenomeModifier(params: {
  journeyKey: JourneyId
  profile?: {
    household?: string
    home_type?: string
    transport_baseline?: string
    age?: ProfileAge | string
    employment_status?: string
  }
  journeyAnswers: Record<JourneyId, Record<string, string>>
}): { modifier: number; hasGenomeData: boolean } {
  const answers = params.journeyAnswers[params.journeyKey] ?? {}
  const answeredCount = Object.keys(answers).filter((k) => String(answers[k] ?? '').trim().length > 0).length
  const profileSignals = [
    params.profile?.household,
    params.profile?.home_type,
    params.profile?.transport_baseline,
    params.profile?.employment_status,
  ].filter((v) => String(v ?? '').trim().length > 0).length
  const hasGenomeData = answeredCount > 0 && profileSignals >= 2
  const raw = 0.72 + answeredCount * 0.08 + profileSignals * 0.04
  return { modifier: Math.min(1.45, Math.max(0.7, raw)), hasGenomeData }
}

function resolveBaselineMarketRate(args: {
  journeyKey: JourneyId
  capGbp: number
  regionalGridIntensityGPerKwh: number
}): { moneyBaseline: number; carbonBaseline: number } {
  const moneyShare: Record<JourneyId, number> = {
    home: 0.34,
    travel: 0.19,
    food: 0.11,
    shopping: 0.08,
    money: 0.09,
    carbon: 0.05,
    tech: 0.05,
    waste: 0.04,
    holidays: 0.05,
  }
  const carbonWeight: Record<JourneyId, number> = {
    home: 3.1,
    travel: 2.4,
    food: 1.5,
    shopping: 0.9,
    money: 0.6,
    carbon: 1.1,
    tech: 0.7,
    waste: 0.8,
    holidays: 1.3,
  }
  const moneyBaseline = Math.max(0, args.capGbp * (moneyShare[args.journeyKey] ?? 0.07))
  const carbonBaseline = Math.max(0, (args.regionalGridIntensityGPerKwh / 100) * (carbonWeight[args.journeyKey] ?? 1))
  return { moneyBaseline, carbonBaseline }
}

function resolveJourneyLiveMarketRate(args: {
  journeyKey: JourneyId
  baselineMoney: number
  profile?: { transport_baseline?: string }
  journeyAnswers: Record<JourneyId, Record<string, string>>
}): number {
  const travelAnswers = args.journeyAnswers.travel ?? {}
  const fuelType = norm(travelAnswers.fuel_type)
  const transport = norm(args.profile?.transport_baseline)
  if (args.journeyKey !== 'travel') return args.baselineMoney
  const carHeavy = transport === 'CAR' || fuelType === 'PETROL' || fuelType === 'DIESEL'
  if (carHeavy) return args.baselineMoney * 1.35
  if (transport === 'BIKE' || transport === 'WALK') return args.baselineMoney * 0.72
  return args.baselineMoney
}

function resolveUserEfficientRate(args: {
  journeyKey: JourneyId
  liveMarketRate: number
  profile?: { transport_baseline?: string; home_type?: string }
  journeyAnswers: Record<JourneyId, Record<string, string>>
}): number {
  const travelAnswers = args.journeyAnswers.travel ?? {}
  const fuelType = norm(travelAnswers.fuel_type)
  const transport = norm(args.profile?.transport_baseline)
  const homeType = norm(args.profile?.home_type)
  let efficientFactor = 0.5
  if (args.journeyKey === 'travel') {
    if (transport === 'CAR' || fuelType === 'PETROL' || fuelType === 'DIESEL') efficientFactor = 0.28
    else if (transport === 'BIKE' || transport === 'WALK') efficientFactor = 0.76
    else if (transport === 'PUBLIC') efficientFactor = 0.62
  } else if (args.journeyKey === 'home') {
    efficientFactor = homeType === 'FLAT' ? 0.58 : 0.48
  }
  return Math.max(0, args.liveMarketRate * efficientFactor)
}

export function buildZoneViewModel({
  profile,
  journeyAnswers,
  scraped,
  localData,
  injectedTips,
  marketContext,
  neonJourneyResearch,
}: {
  profile?: {
    name?: string
    postcode?: string
    household?: string
    home_type?: string
    transport_baseline?: string
    age?: ProfileAge | string
    goal?: string
    employment_status?: string
  }
  journeyAnswers: Record<JourneyId, Record<string, string>>
  /** S UPDATE: optional scraped data from 001 Scraper (`scraped_summary` / DB). Partial = only some journeys may have data. */
  scraped?: Partial<Record<JourneyId, ScrapedDataPoint>>
  /** Local Living: from Postcodes.io; used to add council-specific tip and priority eligibility. */
  localData?: {
    council: string
    localCarbonG?: number
    heat_pump_grant_context?: {
      primary_scheme_label?: string
      primary_max_gbp?: number
      source_url?: string
    }
  }
  /** Discovery injections — latest card surfaces first in the 3 tip slots. */
  injectedTips?: ZoneTipCard[]
  /** v41.1 postcode-grounded market context for dynamic audit maths */
  marketContext?: MarketContext
  /** Neon `research_results`: per-journey `saving_amount_gbp` + `architect_prose` (Trinity when 3 paragraphs). */
  neonJourneyResearch?: Partial<Record<JourneyId, NeonJourneyResearchRow>>
}): ZoneViewModel {
  const scrapedWithGrant = scraped

  // SINGLE SOURCE OF TRUTH: All calculations come from buildUserImpact; scraped overlay applied when provided
  const impactProfile: ImpactProfile | undefined = profile
    ? {
        name: profile.name,
        postcode: profile.postcode,
        household: profile.household,
        home_type: profile.home_type,
        transport_baseline: profile.transport_baseline,
        age: (['JUNIOR', 'MID', 'RETIRED'].includes(String(profile.age ?? ''))
          ? profile.age
          : undefined) as Persona | undefined,
        employment_status: normalizeEmploymentStatus(profile.employment_status),
      }
    : undefined
  const impactOpts =
    scrapedWithGrant || marketContext?.homeUnitRates
      ? {
          ...(scrapedWithGrant ? { scraped: scrapedWithGrant } : {}),
          ...(marketContext?.homeUnitRates ? { homeUnitRates: marketContext.homeUnitRates } : {}),
        }
      : undefined
  const userImpact = buildUserImpact({ profile: impactProfile, journeyAnswers }, impactOpts)

  const journeyImpacts = userImpact.perJourneyResults
  const capGbp = Math.max(1, Number(marketContext?.april2026PriceCapGbp ?? PRICE_CAP_APRIL_2026))
  const regionalGridIntensityGPerKwh = Math.max(
    1,
    Number(marketContext?.regionalGridIntensityGPerKwh ?? localData?.localCarbonG ?? 129)
  )
  const livePostcode = (marketContext?.liveProfilePostcode ?? profile?.postcode ?? '').trim() || undefined
  const hasLiveResearchData = Boolean(marketContext?.liveResearchData)
  const strictLiveFigureGuard = process.env.NODE_ENV === 'production'
  const hasVerifiedSaving = Number.isFinite(marketContext?.verifiedSaving) && Number(marketContext?.verifiedSaving) > 0
  const savingAmt = marketContext?.savingAmountGbp
  const hasVerifiedNeonMoney =
    hasVerifiedSaving ||
    (typeof savingAmt === 'number' && Number.isFinite(savingAmt) && savingAmt > 0)
  /** LIVE badge only when Neon `research_results` money signals exist AND journey genome is complete enough. */
  const vmAuditLive = (genomeIncomplete: boolean): 'LIVE_AUDIT' | 'ESTIMATED_AUDIT' =>
    hasVerifiedNeonMoney && !genomeIncomplete ? 'LIVE_AUDIT' : 'ESTIMATED_AUDIT'
  const marketDeepLink = marketContext?.deepLink?.trim()
  const dynamicJourneyValues = JOURNEY_ORDER.reduce(
    (acc, journeyKey) => {
      const impact = journeyImpacts[journeyKey]
      const baseline = resolveBaselineMarketRate({
        journeyKey,
        capGbp,
        regionalGridIntensityGPerKwh,
      })
      const genome = getGenomeModifier({ journeyKey, profile, journeyAnswers })
      const liveMarketRate = resolveJourneyLiveMarketRate({
        journeyKey,
        baselineMoney: baseline.moneyBaseline,
        profile,
        journeyAnswers,
      })
      const userEfficientRate = resolveUserEfficientRate({
        journeyKey,
        liveMarketRate,
        profile,
        journeyAnswers,
      })
      // v42.7 — True Waste formula lock.
      const trueWasteMoney = Math.max(0, (liveMarketRate - userEfficientRate) * genome.modifier)
      const calculatedMoney = Math.round(trueWasteMoney)
      const calculatedCarbon = Math.max(1, Math.round(baseline.carbonBaseline * genome.modifier))
      const moneyGbp = Math.max(calculatedMoney, Math.round(impact.moneyGbp))
      const carbonKg = Math.max(calculatedCarbon, Math.round(impact.carbonKg))
      acc[journeyKey] = {
        moneyGbp,
        carbonKg,
        estimatedAudit: !genome.hasGenomeData,
      }
      return acc
    },
    {} as Record<JourneyId, { moneyGbp: number; carbonKg: number; estimatedAudit: boolean }>
  )
  const dynamicTotals = JOURNEY_ORDER.reduce(
    (acc, journeyKey) => {
      acc.totalMoney += dynamicJourneyValues[journeyKey].moneyGbp
      acc.totalCarbon += dynamicJourneyValues[journeyKey].carbonKg
      return acc
    },
    { totalMoney: 0, totalCarbon: 0 }
  )

  // HERO CARD - Sum of all journey impacts
  // Hero journey = highest impact journey (for image resolution)
  const heroJourney = JOURNEY_ORDER.reduce((max, key) => {
    const maxImpact = journeyImpacts[max]
    const currentImpact = journeyImpacts[key]
    const maxScore = (maxImpact.carbonKg * 0.6) + (maxImpact.moneyGbp * 0.4)
    const currentScore = (currentImpact.carbonKg * 0.6) + (currentImpact.moneyGbp * 0.4)
    return currentScore > maxScore ? key : max
  }, JOURNEY_ORDER[0])

  const heroImpact = journeyImpacts[heroJourney]
  const hasProfile = Boolean(profile?.postcode ?? profile?.home_type ?? profile?.household)
  const profileName = (profile?.name ?? '').trim()
  const profileHomeType = norm(profile?.home_type)
  const heroContext =
    profileHomeType === 'FLAT'
      ? 'for your flat'
      : profileHomeType === 'HOUSE'
        ? 'for your household'
        : 'for your setup'
  const heroTitle = hasProfile
    ? `${profileName ? `${profileName}, ` : ''}your biggest opportunities ${heroContext}`.trim()
    : 'Top cash-saving hacks for 2026'
  const aprilCapLine = `From April 1st the price cap is ${formatZoneCardMoney(capGbp)} for your current audit context (${livePostcode ?? 'UK profile baseline'}).`
  const baseExplanation = hasProfile
    ? (heroImpact?.explanation?.length
      ? heroImpact.explanation
      : [`Your biggest opportunities ${heroContext} come from the areas above. Tap a card to explore.`])
    : ['UK energy bills are still 40%+ above 2021. Tap a card to see where you could stop overpaying — and cut carbon as a bonus.']
  const heroExplanation =
    heroJourney === 'home' && !baseExplanation.some((s) => s.includes('April 1st'))
      ? [...baseExplanation, aprilCapLine]
      : baseExplanation
  const hero: ZoneHero = {
    id: 'zone-hero',
    variant: 'card-hero',
    title: heroTitle,
    journey_key: heroJourney,
    category: heroJourney,
    data: {
      carbon: formatCarbon(dynamicTotals.totalCarbon),
      money: formatZoneCardMoney(dynamicTotals.totalMoney),
    },
    source: PRICE_CAP_SOURCE_URL,
    sourceLabel: PRICE_CAP_SOURCE_LABEL,
    source_name: PRICE_CAP_SOURCE_LABEL,
    source_date: VERIFIED_SOURCE_DATE,
    partner_link: resolvePartnerLink({
      journey: heroJourney,
      actionType: 'learn',
      needsSwitching: false,
      learnUrl: PRICE_CAP_SOURCE_URL,
      sourceUrl: PRICE_CAP_SOURCE_URL,
      variant: 'hero',
      postcode: profile?.postcode,
    }),
    explanation: heroExplanation,
    actions: {
      actionType: 'learn',
      learnUrl: PRICE_CAP_SOURCE_URL,
    },
  }

  const council = localData?.council

  // JOURNEY CARDS - Exactly 9 cards, one per journey, in JOURNEY_ORDER
  const journeyCards: ZoneJourneyCard[] = JOURNEY_ORDER.map((journeyKey) => {
    const impact = journeyImpacts[journeyKey] as ScrapedOverlayResult
    const fallback = UK_2026_MONEY_LEAD[journeyKey]
    const hasJourneyAnswers = Object.keys(journeyAnswers[journeyKey] ?? {}).length > 0
    if (
      strictLiveFigureGuard &&
      livePostcode &&
      hasJourneyAnswers &&
      hasLiveResearchData &&
      fallback &&
      Math.round(impact.moneyGbp) === Math.round(fallback.money_value) &&
      Math.round(impact.carbonKg) === Math.round(fallback.carbon_value)
    ) {
      console.error(
        `[v42.1] fallback-default-detected: "${journeyKey}" rendered UK_2026_MONEY_LEAD with live postcode "${livePostcode}" despite live research context.`
      )
    }
    const source = getJourneySource(journeyKey, 0)

    // Special case: home journey with provider switching
    const homeAnswers = journeyAnswers.home || {}
    const electricityProvider = homeAnswers.electricity_provider || homeAnswers.energy_provider
    const gasProvider = homeAnswers.gas_provider || homeAnswers.energy_provider
    const hasGreenTariff = homeAnswers.green_tariff === 'YES'
    const isOctopus = electricityProvider === 'OCTOPUS' || gasProvider === 'OCTOPUS'
    const needsSwitching = journeyKey === 'home' && !isOctopus && !hasGreenTariff

    const grantCtx = localData?.heat_pump_grant_context
    const localCouncilTip =
      journeyKey === 'home' && council && grantCtx?.primary_scheme_label
        ? `${grantCtx.primary_scheme_label} in ${council}${typeof grantCtx.primary_max_gbp === 'number' ? ` up to £${grantCtx.primary_max_gbp.toLocaleString('en-GB')}.` : '.'}`
        : undefined

    const localCarbonG = localData?.localCarbonG
    const fallbackClaimUrl =
      journeyKey === 'home' && council
        ? grantCtx?.source_url
        : journeyKey === 'travel'
          ? 'https://www.gov.uk/ev-chargepoint-grant'
          : undefined
    let claimOfferUrl = marketDeepLink || impact.claimOfferUrl || fallbackClaimUrl

    const isPriorityAlert = journeyKey === 'home' && !!council

    const hasLocalGridData = typeof localCarbonG === 'number' && Number.isFinite(localCarbonG)
    const localContextBar =
      hasLocalGridData || (council && grantCtx?.primary_scheme_label)
        ? `${hasLocalGridData ? `Your local grid is running at ${Math.round(localCarbonG)}g CO₂e/kWh` : ''}${hasLocalGridData && council && grantCtx?.primary_scheme_label ? '. ' : ''}${council && grantCtx?.primary_scheme_label ? `In ${council} your live pathway is ${grantCtx.primary_scheme_label}${typeof grantCtx.primary_max_gbp === 'number' ? ` (up to £${grantCtx.primary_max_gbp.toLocaleString('en-GB')})` : ''}.` : ''}`
        : undefined

    const baselineTitle = profileDrivenJourneyTitle(journeyKey, profile, journeyAnswers)
    const insightLabel = impact.insightLabel ?? impact.insight ?? undefined
    const neon = neonJourneyResearch?.[journeyKey]
    let moneyGbp = dynamicJourneyValues[journeyKey].moneyGbp
    if (neon?.savingGbp != null && Number.isFinite(neon.savingGbp) && neon.savingGbp > 0) {
      moneyGbp = Math.round(neon.savingGbp)
    }
    const carbonKg = dynamicJourneyValues[journeyKey].carbonKg
    const genomeIncomplete = dynamicJourneyValues[journeyKey].estimatedAudit
    const estimatedAudit = !hasVerifiedNeonMoney || genomeIncomplete

    const sourceLabel = formatSourceLabel(source)
    if (isGenericHomepageUrl(claimOfferUrl)) claimOfferUrl = undefined
    const locality = council?.trim() || outwardFromPostcode(profile?.postcode)
    const offerTeaserTitle =
      teaserTitleFromOffer(impact.insightLabel) ??
      teaserTitleFromOffer(impact.insight) ??
      teaserTitleFromOffer(localCouncilTip)
    const title =
      offerTeaserTitle ??
      (buildCompactHeadline({
        journey: journeyKey,
        moneyGbp,
        journeyAnswers,
      }) || baselineTitle)
    const learnUrl =
      !isGenericHomepageUrl(claimOfferUrl) ? claimOfferUrl! :
      !isGenericHomepageUrl(source.url) ? source.url :
      buildZaiAuditDeepLink({
        journey: journeyKey,
        title,
        moneyGbp,
        carbonKg,
        locality,
      })
    const userPostcodeForAudit = (profile?.postcode ?? '').trim() || locality
    const sourceNameV35 = formatVerifiedSourceNameFromLabel(sourceLabel)
    const partner_link = resolvePartnerLink({
      journey: journeyKey,
      actionType: needsSwitching ? 'switch' : 'learn',
      needsSwitching,
      claimOfferUrl,
      learnUrl,
      actionUrl: needsSwitching
        ? 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/'
        : undefined,
      sourceUrl: source.url,
      variant: 'journey',
      postcode: profile?.postcode,
    })
    return {
      id: `journey-${journeyKey}`,
      variant: 'card-standard',
      title,
      journey_key: journeyKey,
      category: journeyKey,
      data: {
        carbon: formatCarbon(carbonKg),
        money: formatZoneCardMoney(moneyGbp),
      },
      carbonKg: carbonKg,
      moneyGbp: moneyGbp,
      source: source.url,
      sourceLabel,
      source_name: sourceNameV35,
      source_date: VERIFIED_SOURCE_DATE,
      partner_link,
      explanation:
        trinityExplanationFromArchitectProse(neon?.architectProse ?? null) ??
        buildAuditorNarrativeParagraphs({
          userPostcode: userPostcodeForAudit,
          sourceName: sourceNameV35,
          journey: journeyKey,
          moneyGbp,
          carbonKg,
          locality,
        }),
      actions: {
        actionType: needsSwitching ? 'switch' : 'learn',
        learnUrl,
        actionUrl: needsSwitching
          ? 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/'
          : undefined,
      },
      insightLabel: insightLabel,
      insightAlert: impact.insightAlert,
      fromScraper: impact.fromScraper,
      localCouncilTip,
      localContextBar,
      claimOfferUrl,
      isPriorityAlert,
      auditState: estimatedAudit ? 'ESTIMATED_AUDIT' : 'LIVE_AUDIT',
      followUp: estimatedAudit
        ? {
            question: 'Quick Child Question: confirm your setup to refine the estimate.',
            options: ['Yes, refine now', 'Skip for now'],
            targetField: 'audit_refine',
          }
        : undefined,
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel,
        sourceUrl: source.url,
      }),
    }
  })

  // GENERAL CARDS - Three card-standard entries for "act now." based on profile (household, home_type, transport_baseline)
  // Calculation logic lives in lib/brains/buildUserImpact.ts (Single Source of Truth)
  const [generalHomeLiving, generalTransport, generalHomeExtra] = userImpact.generalCards
  const generalHomeMoney = Math.max(Math.round(generalHomeLiving.moneyGbp), Math.round(capGbp * 0.16))
  const generalTravelMoney = Math.max(Math.round(generalTransport.moneyGbp), Math.round(capGbp * 0.1))
  const generalHomeExtraMoney = Math.max(Math.round(generalHomeExtra.moneyGbp), Math.round(capGbp * 0.12))
  const generalTitles = getGeneralCardTitles(profile)
  const homeSource = getJourneySource('home', 1)
  const travelSource = getJourneySource('travel', 1)
  const homeSource2 = getJourneySource('home', 2)

  const generalHomeLabel = formatSourceLabel(homeSource)
  const generalTravelLabel = formatSourceLabel(travelSource)
  const generalHome2Label = formatSourceLabel(homeSource2)
  const auditLocality = council?.trim() || outwardFromPostcode(profile?.postcode)
  const generalPc = (profile?.postcode ?? '').trim() || auditLocality
  const generalCards: ZoneJourneyCard[] = [
    {
      id: 'general-home-living',
      variant: 'card-standard',
      title: generalTitles.homeLiving,
      journey_key: 'home',
      category: 'home',
      data: {
        carbon: formatCarbon(generalHomeLiving.carbonKg),
        money: formatZoneCardMoney(generalHomeMoney),
      },
      source: homeSource.url,
      sourceLabel: generalHomeLabel,
      source_name: formatVerifiedSourceNameFromLabel(generalHomeLabel),
      source_date: VERIFIED_SOURCE_DATE,
      partner_link: resolvePartnerLink({
        journey: 'home',
        actionType: 'learn',
        needsSwitching: false,
        learnUrl: homeSource.url,
        sourceUrl: homeSource.url,
        variant: 'journey',
        postcode: profile?.postcode,
      }),
      explanation: buildAuditorNarrativeParagraphs({
        userPostcode: generalPc,
        sourceName: formatVerifiedSourceNameFromLabel(generalHomeLabel),
        journey: 'home',
        moneyGbp: generalHomeMoney,
        carbonKg: generalHomeLiving.carbonKg,
        locality: auditLocality,
      }),
      actions: { actionType: 'learn', learnUrl: homeSource.url },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: generalHomeLabel,
        sourceUrl: homeSource.url,
      }),
      auditState: vmAuditLive(false),
    },
    {
      id: 'general-transport',
      variant: 'card-standard',
      title: generalTitles.transport,
      journey_key: 'travel',
      category: 'travel',
      data: {
        carbon: formatCarbon(generalTransport.carbonKg),
        money: formatZoneCardMoney(generalTravelMoney),
      },
      source: travelSource.url,
      sourceLabel: generalTravelLabel,
      source_name: formatVerifiedSourceNameFromLabel(generalTravelLabel),
      source_date: VERIFIED_SOURCE_DATE,
      partner_link: resolvePartnerLink({
        journey: 'travel',
        actionType: 'learn',
        needsSwitching: false,
        learnUrl: travelSource.url,
        sourceUrl: travelSource.url,
        variant: 'journey',
        postcode: profile?.postcode,
      }),
      explanation: buildAuditorNarrativeParagraphs({
        userPostcode: generalPc,
        sourceName: formatVerifiedSourceNameFromLabel(generalTravelLabel),
        journey: 'travel',
        moneyGbp: generalTravelMoney,
        carbonKg: generalTransport.carbonKg,
        locality: auditLocality,
      }),
      actions: { actionType: 'learn', learnUrl: travelSource.url },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: generalTravelLabel,
        sourceUrl: travelSource.url,
      }),
      auditState: vmAuditLive(false),
    },
    {
      id: 'general-home-extra',
      variant: 'card-standard',
      title: generalTitles.homeExtra,
      journey_key: 'home',
      category: 'home',
      data: {
        carbon: formatCarbon(generalHomeExtra.carbonKg),
        money: formatZoneCardMoney(generalHomeExtraMoney),
      },
      source: homeSource2.url,
      sourceLabel: generalHome2Label,
      source_name: formatVerifiedSourceNameFromLabel(generalHome2Label),
      source_date: VERIFIED_SOURCE_DATE,
      partner_link: resolvePartnerLink({
        journey: 'home',
        actionType: 'learn',
        needsSwitching: false,
        learnUrl: homeSource2.url,
        sourceUrl: homeSource2.url,
        variant: 'journey',
        postcode: profile?.postcode,
      }),
      explanation: buildAuditorNarrativeParagraphs({
        userPostcode: generalPc,
        sourceName: formatVerifiedSourceNameFromLabel(generalHome2Label),
        journey: 'home',
        moneyGbp: generalHomeExtraMoney,
        carbonKg: generalHomeExtra.carbonKg,
        locality: auditLocality,
      }),
      actions: { actionType: 'learn', learnUrl: homeSource2.url },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: generalHome2Label,
        sourceUrl: homeSource2.url,
      }),
      auditState: vmAuditLive(false),
    },
  ]

  const journeys: ZoneJourneyCard[] = [...journeyCards, ...generalCards]

  // TIPS - Top 3 journeys by carbon impact
  // Special case: If home provider is not green, add switching tip
  const homeAnswers = journeyAnswers.home || {}
  const electricityProvider = homeAnswers.electricity_provider || homeAnswers.energy_provider
  const gasProvider = homeAnswers.gas_provider || homeAnswers.energy_provider
  const hasGreenTariff = homeAnswers.green_tariff === 'YES'
  const isOctopus = electricityProvider === 'OCTOPUS' || gasProvider === 'OCTOPUS'
  const needsSwitching = !isOctopus && !hasGreenTariff

  // Pink tips — MVP pillars (home / travel / food) from Pulse 0 Firecrawl+Neon, then carbon-ranked fill.
  const MVP_INTAKE_TIP_JOURNEYS: JourneyId[] = ['home', 'travel', 'food']
  const age = profile?.age ?? 'MID'
  const personaBoost: Partial<Record<JourneyId, number>> =
    age === 'JUNIOR'
      ? { tech: 600, food: 600 }
      : age === 'RETIRED'
        ? { home: 600 }
        : {}
  const rankedJourneys = JOURNEY_ORDER.map((journeyKey) => ({
    journeyKey,
    impact: journeyImpacts[journeyKey],
    score: dynamicJourneyValues[journeyKey].carbonKg + (personaBoost[journeyKey] ?? 0),
  })).sort((a, b) => b.score - a.score)
  const intakeReady = MVP_INTAKE_TIP_JOURNEYS.filter((j) => {
    const neon = neonJourneyResearch?.[j]
    return neon?.savingGbp != null && Number.isFinite(neon.savingGbp) && neon.savingGbp > 0
  })
  const tipJourneyKeys: JourneyId[] = []
  for (const j of intakeReady.length >= 3 ? intakeReady : MVP_INTAKE_TIP_JOURNEYS) {
    if (!tipJourneyKeys.includes(j)) tipJourneyKeys.push(j)
    if (tipJourneyKeys.length >= 3) break
  }
  for (const { journeyKey } of rankedJourneys) {
    if (tipJourneyKeys.length >= 3) break
    if (!tipJourneyKeys.includes(journeyKey)) tipJourneyKeys.push(journeyKey)
  }
  const sortedJourneys = tipJourneyKeys.map((journeyKey) => ({
    journeyKey,
    impact: journeyImpacts[journeyKey],
    score: dynamicJourneyValues[journeyKey].carbonKg + (personaBoost[journeyKey] ?? 0),
  }))

  let tips: ZoneTipCard[] = sortedJourneys.map(({ journeyKey }) => {
    const source = getJourneySource(journeyKey, 0)
    
    // Special title for home switching tip
    let title = buildCompactHeadline({
      journey: journeyKey,
      moneyGbp: dynamicJourneyValues[journeyKey].moneyGbp,
      journeyAnswers,
    })
    if (journeyKey === 'home' && needsSwitching) {
      title = 'switch to a greener tariff'
    }
    
    // Determine action for tip
    const homeAnswers = journeyAnswers.home || {}
    const electricityProvider = homeAnswers.electricity_provider || homeAnswers.energy_provider
    const gasProvider = homeAnswers.gas_provider || homeAnswers.energy_provider
    const hasGreenTariff = homeAnswers.green_tariff === 'YES'
    const isOctopus = electricityProvider === 'OCTOPUS' || gasProvider === 'OCTOPUS'
    const tipNeedsSwitching = journeyKey === 'home' && !isOctopus && !hasGreenTariff
    
    const tipSourceLabel =
      journeyKey === 'home' && tipNeedsSwitching
        ? 'source. energy saving trust'
        : formatSourceLabel(source)
    const tipLearn = source.url
    const tipAction = tipNeedsSwitching
      ? 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/'
      : undefined
    const tipLocality = council?.trim() || outwardFromPostcode(profile?.postcode)
    const tipPc = (profile?.postcode ?? '').trim() || tipLocality
    const tipNameV35 = formatVerifiedSourceNameFromLabel(tipSourceLabel)
    const tipPartner = resolvePartnerLink({
      journey: journeyKey,
      actionType: tipNeedsSwitching ? 'switch' : 'learn',
      needsSwitching: tipNeedsSwitching,
      learnUrl: tipLearn,
      actionUrl: tipAction,
      sourceUrl: source.url,
      variant: 'tip',
      postcode: profile?.postcode,
    })
    return {
      id: `tip-${journeyKey}`,
      variant: 'card-compact' as const,
      title,
      journey_key: journeyKey,
      category: journeyKey,
      data: {
        carbon: formatCarbon(dynamicJourneyValues[journeyKey].carbonKg),
        money: formatZoneCardMoney(dynamicJourneyValues[journeyKey].moneyGbp),
      },
      source: source.url,
      sourceLabel: tipSourceLabel,
      source_name: tipNameV35,
      source_date: VERIFIED_SOURCE_DATE,
      partner_link: tipPartner,
      explanation: buildAuditorNarrativeParagraphs({
        userPostcode: tipPc,
        sourceName: tipNameV35,
        journey: journeyKey,
        moneyGbp: dynamicJourneyValues[journeyKey].moneyGbp,
        carbonKg: dynamicJourneyValues[journeyKey].carbonKg,
        locality: tipLocality,
      }),
      actions: {
        actionType: tipNeedsSwitching ? 'switch' : 'learn',
        learnUrl: tipLearn,
        actionUrl: tipAction,
      },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: tipSourceLabel,
        sourceUrl: source.url,
      }),
      auditState: vmAuditLive(dynamicJourneyValues[journeyKey].estimatedAudit),
    }
  })

  // If home is not in top 3 but needs switching, replace lowest with home switching tip
  if (needsSwitching && !sortedJourneys.some(j => j.journeyKey === 'home')) {
    const homeImpact = journeyImpacts.home
    const lowestTip = tips[tips.length - 1]
    if (homeImpact.carbonKg > (journeyImpacts[lowestTip.journey_key as JourneyId]?.carbonKg || 0)) {
      const source = getJourneySource('home', 0)
      const swLabel = 'source. energy saving trust'
      const swLocality = council?.trim() || outwardFromPostcode(profile?.postcode)
      const swPc = (profile?.postcode ?? '').trim() || swLocality
      const swName = formatVerifiedSourceNameFromLabel(swLabel)
      tips[tips.length - 1] = {
        id: 'tip-home-switching',
        variant: 'card-compact' as const,
        title: 'switch to a greener tariff',
        journey_key: 'home',
        category: 'home',
        data: {
          carbon: formatCarbon(dynamicJourneyValues.home.carbonKg),
          money: formatZoneCardMoney(dynamicJourneyValues.home.moneyGbp),
        },
        source: source.url,
        sourceLabel: swLabel,
        source_name: swName,
        source_date: VERIFIED_SOURCE_DATE,
        partner_link: resolvePartnerLink({
          journey: 'home',
          actionType: 'switch',
          needsSwitching: true,
          learnUrl: source.url,
          actionUrl: 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/',
          sourceUrl: source.url,
          variant: 'tip',
          postcode: profile?.postcode,
        }),
        explanation: buildAuditorNarrativeParagraphs({
          userPostcode: swPc,
          sourceName: swName,
          journey: 'home',
          moneyGbp: dynamicJourneyValues.home.moneyGbp,
          carbonKg: dynamicJourneyValues.home.carbonKg,
          locality: swLocality,
        }),
        actions: {
          actionType: 'switch',
          learnUrl: source.url,
          actionUrl: 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/',
        },
        architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
          sourceLabel: swLabel,
          sourceUrl: source.url,
        }),
        auditState: vmAuditLive(dynamicJourneyValues.home.estimatedAudit),
      }
    }
  }

  tips = mergeDiscoveryInjectionsIntoTips(tips, injectedTips, profile?.goal)

  // VALIDATION CHECKS — act now. grid: 9 journey + 3 general = 12 card-standard
  if (journeys.length !== 12) {
    console.error(
      `[Zone] Expected 12 act now. cards (9 journey + 3 general), got ${journeys.length}`
    )
  }
  if (tips.length !== 3) {
    console.error(`[Zone] Expected 3 tip cards, got ${tips.length}`)
  }
  if (!hero) {
    console.error('[Zone] Hero card is missing')
  }

  return {
    hero,
    journeys,
    tips,
  }
}
