/**
 * Canonical https URLs for Zone tips / discovery — single source for fallbacks when models omit links.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_IDS } from '@/lib/journeys'

export const TRUSTED_JOURNEY_URLS: Record<JourneyId, string> = {
  home: 'https://www.energysavingtrust.org.uk/advice/reducing-home-heat-loss/',
  grants: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
  solar: 'https://mcscertified.com/find-an-installer/',
  travel: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
  holidays: 'https://www.eurostar.com/uk-en/deals',
  food: 'https://www.lovefoodhatewaste.com',
  shopping: 'https://wrap.org.uk/taking-action/food-waste',
  money: 'https://www.moneysavingexpert.com/utilities/how-to-switch-gas-electricity/',
  tech: 'https://www.backmarket.co.uk',
  water: 'https://www.waterwise.org.uk/save-water/',
  waste: 'https://www.recyclenow.com',
  carbon: 'https://www.carbontrust.com/resources',
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
    GRANTS: 'grants',
    SOLAR: 'solar',
    WATER: 'water',
    BILLS: 'money',
  }
  if (map[c]) return map[c]
  if ((JOURNEY_IDS as readonly string[]).includes(c.toLowerCase())) return c.toLowerCase() as JourneyId
  return 'home'
}
