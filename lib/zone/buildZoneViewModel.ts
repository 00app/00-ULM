// Locked Zone view model builder
// Data flow: Profile + Journey Answers → buildUserImpact → Zone View Model
// NO calculations here — all £/kg from buildUserImpact.
//
// v1.8.12 Content Architect: sync `architectSuppliedBy` on every journey/general/tip row via
// `defaultVerifiedArchitectSuppliedBy`. Async WHAT/WHY/HOW from Gemini: client POSTs
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
import { PRICE_CAP_APRIL_2026, PRICE_CAP_SAVING_APRIL_1, PRICE_CAP_SOURCE_URL, PRICE_CAP_SOURCE_LABEL } from '@/lib/brains/constants'

export interface ZoneHero {
  id: string
  variant: 'card-hero'
  title: string
  journey_key?: JourneyId
  category?: JourneyId
  data: { carbon: string; money: string }
  source?: string
  sourceLabel?: string
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
  /** Local Living: council-specific tip for OpenClaw (e.g. "Warm Homes Local Grant in [Council]") */
  localCouncilTip?: string
  /** v1.3: council + local grid intensity for expanded card (punchy Roboto text). */
  localContextBar?: string
  /** S Update: "Claim Offer" deep-link (GOV.UK or council application). */
  claimOfferUrl?: string
  /** S Update: Warm Homes / priority eligible → pulsing gold border. */
  isPriorityAlert?: boolean
  /** True Card: dynamic CTA and follow-up (when card comes from OpenClaw). */
  cta?: { label: string; url: string }
  followUp?: { question: string; options: string[]; targetField: string }
  /** Content Architect (Gemini): verified attribution short name, e.g. GOV.UK */
  architectSuppliedBy?: string
  /** Content Architect: imperative HOW line (Solo Focus). */
  architectActionLine?: string
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
  /** Verified short attribution (sync + Content Architect). */
  architectSuppliedBy?: string
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

export function buildZoneViewModel({
  profile,
  journeyAnswers,
  scraped,
  localData,
  injectedTips,
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
  /** S UPDATE: optional scraped data from 001 Scraper (e.g. from /api/zone or scraped_summary). Partial = only some journeys may have data. */
  scraped?: Partial<Record<JourneyId, ScrapedDataPoint>>
  /** Local Living: from Postcodes.io; used to add council-specific tip and priority eligibility. */
  localData?: { council: string; localCarbonG?: number }
  /** OpenClaw / discovery injections — latest card surfaces first in the 3 tip slots. */
  injectedTips?: ZoneTipCard[]
}): ZoneViewModel {
  const isKwPostcode = Boolean(profile?.postcode?.replace(/\s+/g, '').toUpperCase().startsWith('KW'))
  const homeGrantAmount = isKwPostcode ? 9000 : 7500
  // Boiler Upgrade Scheme £7,500: when user has council (location known), inject into home scraped overlay so buildUserImpact adds it to money
  const homeStub = (existing?: ScrapedDataPoint): ScrapedDataPoint => ({
    journey_key: 'home',
    scraped_at: existing?.scraped_at ?? new Date().toISOString(),
    carbon_value: existing?.carbon_value ?? 0,
    money_value: existing?.money_value ?? 0,
    local_grant_gbp: homeGrantAmount,
    ...(existing?.deep_content_tip && { deep_content_tip: existing.deep_content_tip }),
    ...(existing?.high_saving !== undefined && { high_saving: existing.high_saving }),
  })
  const scrapedWithGrant =
    localData?.council && scraped
      ? { ...scraped, home: homeStub(scraped.home) }
      : localData?.council && !scraped
        ? ({ home: homeStub() } as Partial<Record<JourneyId, ScrapedDataPoint>>)
        : scraped

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
  const userImpact = buildUserImpact(
    { profile: impactProfile, journeyAnswers },
    scrapedWithGrant ? { scraped: scrapedWithGrant } : undefined
  )

  const journeyImpacts = userImpact.perJourneyResults
  const { totalCarbon, totalMoney } = userImpact.totals

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
  const heroTitle = hasProfile
    ? 'your biggest opportunities'
    : 'Top cash-saving hacks for 2026'
  const aprilCapLine = `From April 1st the price cap drops to ${formatZoneCardMoney(PRICE_CAP_APRIL_2026)} (save £${PRICE_CAP_SAVING_APRIL_1}/yr).`
  const baseExplanation = hasProfile
    ? (heroImpact?.explanation?.length ? heroImpact.explanation : ['Your biggest opportunities come from the areas above. Tap a card to explore.'])
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
      carbon: formatCarbon(totalCarbon),
      money: formatZoneCardMoney(totalMoney),
    },
    source: PRICE_CAP_SOURCE_URL,
    sourceLabel: PRICE_CAP_SOURCE_LABEL,
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
    const source = getJourneySource(journeyKey, 0)

    // Special case: home journey with provider switching
    const homeAnswers = journeyAnswers.home || {}
    const electricityProvider = homeAnswers.electricity_provider || homeAnswers.energy_provider
    const gasProvider = homeAnswers.gas_provider || homeAnswers.energy_provider
    const hasGreenTariff = homeAnswers.green_tariff === 'YES'
    const isOctopus = electricityProvider === 'OCTOPUS' || gasProvider === 'OCTOPUS'
    const needsSwitching = journeyKey === 'home' && !isOctopus && !hasGreenTariff

    const localCouncilTip =
      journeyKey === 'home' && council
        ? `Warm Homes Local Grant in ${council}. Boiler Upgrade Scheme £7,500.`
        : undefined

    const localCarbonG = localData?.localCarbonG
    const fallbackClaimUrl =
      journeyKey === 'home' && council
        ? 'https://www.gov.uk/apply-boiler-upgrade-scheme'
        : journeyKey === 'travel'
          ? 'https://www.gov.uk/ev-chargepoint-grant'
          : undefined
    let claimOfferUrl = impact.claimOfferUrl ?? fallbackClaimUrl

    const isPriorityAlert = journeyKey === 'home' && !!council

    const localContextBar =
      council || localCarbonG != null
        ? `Your local grid is running at ${localCarbonG ?? '—'}g CO₂e/kWh${council ? `. In ${council} you're eligible for Boiler Upgrade Scheme (£7,500).` : ''}`
        : undefined

    // -------------------------------------------------------------
    // WICK KW INTERCEPTOR
    // -------------------------------------------------------------
    let title = JOURNEY_TITLES[journeyKey]
    let insightLabel = impact.insightLabel ?? impact.insight ?? undefined
    let moneyGbp = impact.moneyGbp
    
    if (isKwPostcode && journeyKey === 'home') {
      title = '£9,000 RURAL HEAT GRANT'
      insightLabel = 'Scottish Govt £7,500 + £1,500 Rural Uplift Available'
      claimOfferUrl = 'https://www.homeenergyscotland.org/home-energy-scotland-grant-loan'
      moneyGbp = 9000
    }

    const sourceLabel = formatSourceLabel(source)
    return {
      id: `journey-${journeyKey}`,
      variant: 'card-standard',
      title: title,
      journey_key: journeyKey,
      category: journeyKey,
      data: {
        carbon: formatCarbon(impact.carbonKg),
        money: formatZoneCardMoney(moneyGbp),
      },
      carbonKg: impact.carbonKg,
      moneyGbp: moneyGbp,
      source: source.url,
      sourceLabel,
      explanation: impact.explanation,
      actions: {
        actionType: needsSwitching ? 'switch' : 'learn',
        learnUrl: source.url,
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
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel,
        sourceUrl: source.url,
      }),
    }
  })

  // GENERAL CARDS - Three card-standard entries for "act now." based on profile (household, home_type, transport_baseline)
  // Calculation logic lives in lib/brains/buildUserImpact.ts (Single Source of Truth)
  const [generalHomeLiving, generalTransport, generalHomeExtra] = userImpact.generalCards
  const generalTitles = getGeneralCardTitles(profile)
  const homeSource = getJourneySource('home', 1)
  const travelSource = getJourneySource('travel', 1)
  const homeSource2 = getJourneySource('home', 2)

  const generalHomeLabel = formatSourceLabel(homeSource)
  const generalTravelLabel = formatSourceLabel(travelSource)
  const generalHome2Label = formatSourceLabel(homeSource2)
  const generalCards: ZoneJourneyCard[] = [
    {
      id: 'general-home-living',
      variant: 'card-standard',
      title: generalTitles.homeLiving,
      journey_key: 'home',
      category: 'home',
      data: {
        carbon: formatCarbon(generalHomeLiving.carbonKg),
        money: formatZoneCardMoney(generalHomeLiving.moneyGbp),
      },
      source: homeSource.url,
      sourceLabel: generalHomeLabel,
      explanation: generalHomeLiving.explanation,
      actions: { actionType: 'learn', learnUrl: homeSource.url },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: generalHomeLabel,
        sourceUrl: homeSource.url,
      }),
    },
    {
      id: 'general-transport',
      variant: 'card-standard',
      title: generalTitles.transport,
      journey_key: 'travel',
      category: 'travel',
      data: {
        carbon: formatCarbon(generalTransport.carbonKg),
        money: formatZoneCardMoney(generalTransport.moneyGbp),
      },
      source: travelSource.url,
      sourceLabel: generalTravelLabel,
      explanation: generalTransport.explanation,
      actions: { actionType: 'learn', learnUrl: travelSource.url },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: generalTravelLabel,
        sourceUrl: travelSource.url,
      }),
    },
    {
      id: 'general-home-extra',
      variant: 'card-standard',
      title: generalTitles.homeExtra,
      journey_key: 'home',
      category: 'home',
      data: {
        carbon: formatCarbon(generalHomeExtra.carbonKg),
        money: formatZoneCardMoney(generalHomeExtra.moneyGbp),
      },
      source: homeSource2.url,
      sourceLabel: generalHome2Label,
      explanation: generalHomeExtra.explanation,
      actions: { actionType: 'learn', learnUrl: homeSource2.url },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: generalHome2Label,
        sourceUrl: homeSource2.url,
      }),
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

  // Build tips: top 3 by carbon, biased by age persona (Junior → food/tech, Retired → home only; Spec v1.4)
  const age = profile?.age ?? 'MID'
  const personaBoost: Partial<Record<JourneyId, number>> =
    age === 'JUNIOR'
      ? { tech: 600, food: 600 }
      : age === 'RETIRED'
        ? { home: 600 }
        : {}
  const sortedJourneys = JOURNEY_ORDER.map((journeyKey) => ({
    journeyKey,
    impact: journeyImpacts[journeyKey],
    score: journeyImpacts[journeyKey].carbonKg + (personaBoost[journeyKey] ?? 0),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  let tips: ZoneTipCard[] = sortedJourneys.map(({ journeyKey, impact }) => {
    const source = getJourneySource(journeyKey, 0)
    
    // Special title for home switching tip
    let title = JOURNEY_TITLES[journeyKey]
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
    return {
      id: `tip-${journeyKey}`,
      variant: 'card-compact' as const,
      title,
      journey_key: journeyKey,
      category: journeyKey,
      data: {
        carbon: formatCarbon(impact.carbonKg),
        money: formatZoneCardMoney(impact.moneyGbp),
      },
      source: source.url,
      sourceLabel: tipSourceLabel,
      explanation: impact.explanation,
      actions: {
        actionType: tipNeedsSwitching ? 'switch' : 'learn',
        learnUrl: source.url,
        actionUrl: tipNeedsSwitching
          ? 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/'
          : undefined,
      },
      architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
        sourceLabel: tipSourceLabel,
        sourceUrl: source.url,
      }),
    }
  })

  // If home is not in top 3 but needs switching, replace lowest with home switching tip
  if (needsSwitching && !sortedJourneys.some(j => j.journeyKey === 'home')) {
    const homeImpact = journeyImpacts.home
    const lowestTip = tips[tips.length - 1]
    if (homeImpact.carbonKg > (journeyImpacts[lowestTip.journey_key as JourneyId]?.carbonKg || 0)) {
      const source = getJourneySource('home', 0)
      const swLabel = 'source. energy saving trust'
      tips[tips.length - 1] = {
        id: 'tip-home-switching',
        variant: 'card-compact' as const,
        title: 'switch to a greener tariff',
        journey_key: 'home',
        category: 'home',
        data: {
          carbon: formatCarbon(homeImpact.carbonKg),
          money: formatZoneCardMoney(homeImpact.moneyGbp),
        },
        source: source.url,
        sourceLabel: swLabel,
        explanation: homeImpact.explanation,
        actions: {
          actionType: 'switch',
          learnUrl: source.url,
          actionUrl: 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/',
        },
        architectSuppliedBy: defaultVerifiedArchitectSuppliedBy({
          sourceLabel: swLabel,
          sourceUrl: source.url,
        }),
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
