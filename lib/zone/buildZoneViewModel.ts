// Locked Zone view model builder
// Data flow: Profile + Journey Answers → buildUserImpact → Zone View Model
// NO fallbacks, NO placeholders, NO legacy behavior
// NO calculations here - all calculations come from buildUserImpact

console.log('[ZONE] buildZoneViewModel ACTIVE — legacy logic disabled')

import { JourneyId, JOURNEY_ORDER } from '@/lib/journeys'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import { type ImpactResult } from '@/lib/brains/calculations'
import type { ScrapedOverlayResult } from '@/lib/brains/buildUserImpact'
import type { ScrapedDataPoint } from '@/lib/scraper/sources'
import { formatCarbon } from '@/lib/format'
import { getJourneySource, formatSourceLabel } from '@/lib/content/sources'

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
  /** S UPDATE: when true, card gets 1px solid var(--color-blue) Insight Alert border */
  insightAlert?: boolean
  /** S UPDATE: when true, .text-data can use counting animation on first view */
  fromScraper?: boolean
  /** Local Living: council-specific tip for OpenClaw (e.g. "Warm Homes Local Grant in [Council]") */
  localCouncilTip?: string
  /** S Update: "Claim Offer" deep-link (GOV.UK or council application). */
  claimOfferUrl?: string
  /** S Update: Warm Homes / priority eligible → pulsing gold border. */
  isPriorityAlert?: boolean
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

export function buildZoneViewModel({
  profile,
  journeyAnswers,
  scraped,
  localData,
}: {
  profile?: {
    name?: string
    postcode?: string
    household?: string
    home_type?: string
    transport_baseline?: string
    age?: ProfileAge
  }
  journeyAnswers: Record<JourneyId, Record<string, string>>
  /** S UPDATE: optional scraped data from 001 Scraper (e.g. from /api/zone or scraped_summary). Partial = only some journeys may have data. */
  scraped?: Partial<Record<JourneyId, ScrapedDataPoint>>
  /** Local Living: from Postcodes.io; used to add council-specific tip and priority eligibility. */
  localData?: { council: string; localCarbonG?: number }
}): ZoneViewModel {
  // SINGLE SOURCE OF TRUTH: All calculations come from buildUserImpact; scraped overlay applied when provided
  const userImpact = buildUserImpact(
    { profile, journeyAnswers },
    scraped ? { scraped } : undefined
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
  const hero: ZoneHero = {
    id: 'zone-hero',
    variant: 'card-hero',
    title: 'your biggest opportunities',
    journey_key: heroJourney,
    category: heroJourney,
    data: {
      carbon: formatCarbon(totalCarbon),
      money: `£${Math.round(totalMoney)}`,
    },
    source: 'https://www.gov.uk',
    sourceLabel: 'source. uk government data',
    explanation: heroImpact?.explanation?.length
      ? heroImpact.explanation
      : ['Your biggest opportunities come from the areas above. Tap a card to explore.'],
    actions: {
      actionType: 'learn',
      learnUrl: 'https://www.gov.uk',
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
    const claimOfferUrl =
      journeyKey === 'home' && council
        ? 'https://www.gov.uk/apply-boiler-upgrade-scheme'
        : journeyKey === 'travel'
          ? 'https://www.gov.uk/ev-chargepoint-grant'
          : undefined

    const isPriorityAlert = journeyKey === 'home' && !!council

    return {
      id: `journey-${journeyKey}`,
      variant: 'card-standard',
      title: JOURNEY_TITLES[journeyKey],
      journey_key: journeyKey,
      category: journeyKey,
      data: {
        carbon: formatCarbon(impact.carbonKg),
        money: `£${Math.round(impact.moneyGbp)}`,
      },
      carbonKg: impact.carbonKg,
      moneyGbp: impact.moneyGbp,
      source: source.url,
      sourceLabel: formatSourceLabel(source),
      explanation: impact.explanation,
      actions: {
        actionType: needsSwitching ? 'switch' : 'learn',
        learnUrl: source.url,
        actionUrl: needsSwitching
          ? 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/'
          : undefined,
      },
      insightLabel: impact.insightLabel,
      insightAlert: impact.insightAlert,
      fromScraper: impact.fromScraper,
      localCouncilTip,
      claimOfferUrl,
      isPriorityAlert,
    }
  })

  // GENERAL CARDS - Three card-standard entries for "act now." based on profile (household, home_type, transport_baseline)
  // Calculation logic lives in lib/brains/buildUserImpact.ts (Single Source of Truth)
  const [generalHomeLiving, generalTransport, generalHomeExtra] = userImpact.generalCards
  const generalTitles = getGeneralCardTitles(profile)
  const homeSource = getJourneySource('home', 1)
  const travelSource = getJourneySource('travel', 1)
  const homeSource2 = getJourneySource('home', 2)

  const generalCards: ZoneJourneyCard[] = [
    {
      id: 'general-home-living',
      variant: 'card-standard',
      title: generalTitles.homeLiving,
      journey_key: 'home',
      category: 'home',
      data: {
        carbon: formatCarbon(generalHomeLiving.carbonKg),
        money: `£${Math.round(generalHomeLiving.moneyGbp)}`,
      },
      source: homeSource.url,
      sourceLabel: formatSourceLabel(homeSource),
      explanation: generalHomeLiving.explanation,
      actions: { actionType: 'learn', learnUrl: homeSource.url },
    },
    {
      id: 'general-transport',
      variant: 'card-standard',
      title: generalTitles.transport,
      journey_key: 'travel',
      category: 'travel',
      data: {
        carbon: formatCarbon(generalTransport.carbonKg),
        money: `£${Math.round(generalTransport.moneyGbp)}`,
      },
      source: travelSource.url,
      sourceLabel: formatSourceLabel(travelSource),
      explanation: generalTransport.explanation,
      actions: { actionType: 'learn', learnUrl: travelSource.url },
    },
    {
      id: 'general-home-extra',
      variant: 'card-standard',
      title: generalTitles.homeExtra,
      journey_key: 'home',
      category: 'home',
      data: {
        carbon: formatCarbon(generalHomeExtra.carbonKg),
        money: `£${Math.round(generalHomeExtra.moneyGbp)}`,
      },
      source: homeSource2.url,
      sourceLabel: formatSourceLabel(homeSource2),
      explanation: generalHomeExtra.explanation,
      actions: { actionType: 'learn', learnUrl: homeSource2.url },
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

  // Build tips: top 3 by carbon, biased by age persona (Junior → tech/food, Retired → home/holidays)
  const age = profile?.age ?? 'MID'
  const personaBoost: Partial<Record<JourneyId, number>> =
    age === 'JUNIOR'
      ? { tech: 600, food: 600 }
      : age === 'RETIRED'
        ? { home: 600, holidays: 600 }
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
    
    return {
      id: `tip-${journeyKey}`,
      variant: 'card-compact' as const,
      title,
      journey_key: journeyKey,
      category: journeyKey,
      data: {
        carbon: formatCarbon(impact.carbonKg),
        money: `£${Math.round(impact.moneyGbp)}`,
      },
      source: source.url,
      sourceLabel: journeyKey === 'home' && tipNeedsSwitching
        ? 'source. energy saving trust'
        : formatSourceLabel(source),
      explanation: impact.explanation,
      actions: {
        actionType: tipNeedsSwitching ? 'switch' : 'learn',
        learnUrl: source.url,
        actionUrl: tipNeedsSwitching
          ? 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/'
          : undefined,
      },
    }
  })

  // If home is not in top 3 but needs switching, replace lowest with home switching tip
  if (needsSwitching && !sortedJourneys.some(j => j.journeyKey === 'home')) {
    const homeImpact = journeyImpacts.home
    const lowestTip = tips[tips.length - 1]
    if (homeImpact.carbonKg > (journeyImpacts[lowestTip.journey_key as JourneyId]?.carbonKg || 0)) {
      const source = getJourneySource('home', 0)
      tips[tips.length - 1] = {
        id: 'tip-home-switching',
        variant: 'card-compact' as const,
        title: 'switch to a greener tariff',
        journey_key: 'home',
        category: 'home',
        data: {
          carbon: formatCarbon(homeImpact.carbonKg),
          money: `£${Math.round(homeImpact.moneyGbp)}`,
        },
        source: source.url,
        sourceLabel: 'source. energy saving trust',
        explanation: homeImpact.explanation,
        actions: {
          actionType: 'switch',
          learnUrl: source.url,
          actionUrl: 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/',
        },
      }
    }
  }

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
