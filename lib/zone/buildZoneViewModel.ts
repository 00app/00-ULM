// Locked Zone view model builder
// Data flow: Profile + Journey Answers → buildUserImpact → Zone View Model
// NO fallbacks, NO placeholders, NO legacy behavior
// NO calculations here - all calculations come from buildUserImpact

console.log('[ZONE] buildZoneViewModel ACTIVE — legacy logic disabled')

import { JourneyId, JOURNEY_ORDER } from '@/lib/journeys'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import { type ImpactResult } from '@/lib/brains/calculations'
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
  source?: string
  sourceLabel?: string
  explanation?: string[]
  actions?: {
    actionType: 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view'
    learnUrl: string
    actionUrl?: string
  }
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

// Re-export getJourneyImpact from buildUserImpact (single source of truth)
export { getJourneyImpact } from '@/lib/brains/buildUserImpact'

export function buildZoneViewModel({
  profile,
  journeyAnswers,
}: {
  profile?: {
    name?: string
    postcode?: string
    household?: string
    home_type?: string
    transport_baseline?: string
  }
  journeyAnswers: Record<JourneyId, Record<string, string>>
}): ZoneViewModel {
  // SINGLE SOURCE OF TRUTH: All calculations come from buildUserImpact
  const userImpact = buildUserImpact({
    profile,
    journeyAnswers,
  })

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

  // JOURNEY CARDS - Exactly 9 cards, one per journey, in JOURNEY_ORDER
  const journeys: ZoneJourneyCard[] = JOURNEY_ORDER.map((journeyKey) => {
    const impact = journeyImpacts[journeyKey]
    const source = getJourneySource(journeyKey, 0)

    // Special case: home journey with provider switching
    const homeAnswers = journeyAnswers.home || {}
    const electricityProvider = homeAnswers.electricity_provider || homeAnswers.energy_provider
    const gasProvider = homeAnswers.gas_provider || homeAnswers.energy_provider
    const hasGreenTariff = homeAnswers.green_tariff === 'YES'
    const isOctopus = electricityProvider === 'OCTOPUS' || gasProvider === 'OCTOPUS'
    const needsSwitching = journeyKey === 'home' && !isOctopus && !hasGreenTariff

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
    }
  })

  // TIPS - Top 3 journeys by carbon impact
  // Special case: If home provider is not green, add switching tip
  const homeAnswers = journeyAnswers.home || {}
  const electricityProvider = homeAnswers.electricity_provider || homeAnswers.energy_provider
  const gasProvider = homeAnswers.gas_provider || homeAnswers.energy_provider
  const hasGreenTariff = homeAnswers.green_tariff === 'YES'
  const isOctopus = electricityProvider === 'OCTOPUS' || gasProvider === 'OCTOPUS'
  const needsSwitching = !isOctopus && !hasGreenTariff

  // Build tips from top carbon impact journeys
  const sortedJourneys = JOURNEY_ORDER.map((journeyKey) => ({
    journeyKey,
    impact: journeyImpacts[journeyKey],
  })).sort((a, b) => b.impact.carbonKg - a.impact.carbonKg)
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

  // VALIDATION CHECKS
  if (journeys.length !== 9) {
    console.error(
      `[Zone] Expected 9 journey cards, got ${journeys.length}`
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
