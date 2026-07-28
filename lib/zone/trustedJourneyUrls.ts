/**
 * Canonical https URLs for Zone tips / discovery — single source for fallbacks when models omit links.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_IDS } from '@/lib/journeys'

export const TRUSTED_JOURNEY_URLS: Record<JourneyId, string> = {
  home: 'https://www.energysavingtrust.org.uk/advice/reducing-home-heat-loss/',
  utilities: 'https://www.moneysavingexpert.com/cheapenergyclub/',
  // Smart Export Guarantee — the actual scheme that pays for exported solar, not a generic
  // installer directory. Every UK supplier with 150k+ customers must offer an SEG tariff.
  solar: 'https://www.ofgem.gov.uk/environmental-and-social-schemes/smart-export-guarantee-seg',
  travel: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
  holidays: 'https://www.eurostar.com/uk-en/deals',
  // Too Good To Go — real, specific, 6.6M UK users; turns unsold shop/restaurant food into
  // discounted bags, rather than a generic "plan your meals" advice page.
  food: 'https://www.toogoodtogo.co.uk',
  shopping: 'https://wrap.org.uk/taking-action/textiles',
  // Triodos — the one major UK provider that fully excludes fossil fuels from its Stocks &
  // Shares ISA; named Best Ethical Financial Provider at the 2026 British Bank Awards.
  money: 'https://www.triodos.co.uk/ethical-isas',
  tech: 'https://www.backmarket.co.uk',
  // WaterSure — an actual bill-cap scheme (meter + qualifying benefit + large family/medical
  // need), not generic "fix your drips" advice. Real money for eligible households.
  water: 'https://www.citizensadvice.org.uk/consumer/water/problems-with-paying-your-water-bill/watersure-scheme-help-with-paying-water-bills/',
  // TerraCycle — free, brand-funded recycling for the stuff kerbside collection won't take
  // (crisp packets, toothpaste tubes, batteries), not a generic recycling locator.
  waste: 'https://www.terracycle.com/en-GB/',
  // WWF's free 10-minute footprint calculator — a specific tool with a real result, not a
  // generic "resources" hub page.
  carbon: 'https://footprint.wwf.org.uk/',
}

export const DEFAULT_TRUSTED_URL = 'https://www.gov.uk/'

export function isHttpsUrl(s: string | undefined | null): boolean {
  if (!s || typeof s !== 'string') return false
  try {
    return new URL(s.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

export function trustedUrlForJourney(j: JourneyId): string {
  return TRUSTED_JOURNEY_URLS[j] ?? DEFAULT_TRUSTED_URL
}

/** Secondary CTAs when the primary trusted URL is already on the wall for this journey. */
export const TRUSTED_JOURNEY_URL_ALTERNATES: Partial<Record<JourneyId, readonly string[]>> = {
  // gov.uk/guidance/rail-fares-and-season-tickets (dead, confirmed real 404) intentionally
  // dropped — no stable evergreen successor found, only news/press-release pages.
  travel: [
    'https://www.thetrainline.com/information/cheap-train-tickets',
    'https://www.railcard.co.uk/about-railcards/',
  ],
  holidays: ['https://www.visitbritain.com/'],
  utilities: ['https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap'],
  solar: ['https://mcscertified.com/find-an-installer/'],
  // Olio — free neighbour-to-neighbour food sharing, distinct from Too Good To Go's paid
  // surplus bags; worth surfacing as the second card on a repeat visit.
  food: ['https://olioapp.com/en/'],
  shopping: ['https://therestartproject.org/', 'https://www.vinted.co.uk/'],
  tech: ['https://therestartproject.org/'],
  water: ['https://www.waterwise.org.uk/save-water/'],
  // Freegle — 4M UK members, 450+ local groups; second real option alongside TerraCycle.
  waste: ['https://www.ilovefreegle.org/'],
  carbon: ['https://www.carbontrust.com/resources'],
}

export function normalizeOfferUrlKey(url: string): string {
  const trimmed = url.trim()
  if (!trimmed.startsWith('http')) return ''
  try {
    const u = new URL(trimmed)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    const path = u.pathname.replace(/\/+$/, '') || ''
    return `${host}${path}`
  } catch {
    return ''
  }
}

export function trustedUrlCandidatesForJourney(j: JourneyId): string[] {
  const primary = TRUSTED_JOURNEY_URLS[j]
  const alts = TRUSTED_JOURNEY_URL_ALTERNATES[j] ?? []
  return [primary, ...alts].filter((u): u is string => Boolean(u?.startsWith('https://')))
}

/** Pick a journey-trusted URL not already used on the wall (e.g. second travel tip ≠ duplicate National Rail). */
export function pickUnusedTrustedOfferUrl(
  journeyKey: JourneyId,
  usedKeys: Set<string>
): string {
  for (const url of trustedUrlCandidatesForJourney(journeyKey)) {
    const key = normalizeOfferUrlKey(url)
    if (!key || usedKeys.has(key)) continue
    usedKeys.add(key)
    return url
  }
  const fallback = trustedUrlForJourney(journeyKey)
  usedKeys.add(normalizeOfferUrlKey(fallback))
  return fallback
}

/** Map Gemini / UI category strings to a journey key for URL fallback. */
export function normalizeCategoryToJourneyKey(category: string): JourneyId {
  const c = category.trim().toUpperCase().replace(/[\s-]+/g, '_')
  const map: Record<string, JourneyId> = {
    FOOD: 'food',
    ENERGY: 'home',
    HOME: 'home',
    HOUSE: 'home',
    TRANSPORT: 'travel',
    TRAVEL: 'travel',
    CAR: 'travel',
    EV: 'travel',
    SHOPPING: 'shopping',
    MONEY: 'money',
    CARBON: 'carbon',
    TECH: 'tech',
    WASTE: 'waste',
    HOLIDAYS: 'holidays',
    HOLIDAY: 'holidays',
    SOLAR: 'solar',
    WATER: 'water',
    BILLS: 'money',
  }
  if (map[c]) return map[c]
  if ((JOURNEY_IDS as readonly string[]).includes(c.toLowerCase())) return c.toLowerCase() as JourneyId
  return 'home'
}
