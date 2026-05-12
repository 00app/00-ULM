/**
 * Fallback "best deals" when Gemini free-tier quota is exceeded.
 * Builds 3 injection cards from UK 2026 defaults — rotates across all 9 journey categories
 * using postcode so different users see varied category coverage over time.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'
import { validateInjectionCard } from './injections'
import type { ZoneTipCard } from './buildZoneViewModel'

/** Real publisher names + URLs for fallback attribution (mirrors multi-source research brief). */
const FALLBACK_PUBLISHER: Record<JourneyId, { sourceLabel: string; source: string }> = {
  home: { sourceLabel: 'Energy Saving Trust', source: 'https://energysavingtrust.org.uk/' },
  travel: { sourceLabel: 'Octopus Energy', source: 'https://octopus.energy/' },
  food: { sourceLabel: 'WRAP UK', source: 'https://www.lovefoodhatewaste.com/' },
  shopping: { sourceLabel: 'Which?', source: 'https://www.which.co.uk/money' },
  money: { sourceLabel: 'MoneySavingExpert', source: 'https://www.moneysavingexpert.com/utilities/' },
  carbon: { sourceLabel: 'Ofgem', source: 'https://www.ofgem.gov.uk/' },
  tech: { sourceLabel: 'Which?', source: 'https://www.which.co.uk/reviews' },
  waste: { sourceLabel: 'Energy Saving Trust', source: 'https://energysavingtrust.org.uk/advice' },
  holidays: { sourceLabel: 'Eurostar', source: 'https://www.eurostar.com/' },
}

export function buildFallbackInjectionCards(postcode?: string | null): ZoneTipCard[] {
  const n = JOURNEY_ORDER.length
  const seed =
    postcode && postcode.length > 0
      ? postcode.charCodeAt(0) + (postcode.charCodeAt(postcode.length - 1) ?? 0)
      : Math.floor(Date.now() / 86_400_000)
  const start = seed % n
  const cards: ZoneTipCard[] = []

  for (let i = 0; i < 3; i++) {
    const j = JOURNEY_ORDER[(start + i) % n] as JourneyId
    const d = UK_2026_MONEY_LEAD[j]
    if (!d) continue
    const pub = FALLBACK_PUBLISHER[j]
    const title = d.crawler_tip
      ? d.crawler_tip.split(/[.]/)[0]?.trim().slice(0, 72) ?? d.money_lead
      : d.money_lead
    const raw = {
      id: `inject-fallback-${j}-${start}`,
      title,
      journey_key: j,
      category: j,
      data: {
        money: d.money_lead.startsWith('£') ? d.money_lead : `£${d.money_value}`,
        carbon: `${d.carbon_value} kg CO₂`,
      },
      source: pub.source,
      sourceLabel: pub.sourceLabel,
      actions: { actionType: 'learn' as const, learnUrl: pub.source },
    }
    const card = validateInjectionCard(raw)
    if (card) cards.push(card)
  }
  return cards
}
