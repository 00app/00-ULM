/**
 * Deterministic image helper using Unsplash
 * Format: https://images.unsplash.com/featured/800x600?{keyword}
 * card-compact and card-liked always return null.
 */

import { JourneyId } from '@/lib/journeys'

const UNSPLASH_BASE = 'https://images.unsplash.com/featured/800x600'

const JOURNEY_KEYWORDS: Record<JourneyId, string> = {
  home: 'solar-panels,modern-house',
  utilities: 'gas-meter,electricity-bill',
  grants: 'government-building,uk',
  solar: 'roof-solar-panels',
  travel: 'electric-car,bicycle',
  holidays: 'train-travel',
  food: 'organic-vegetables,vegan',
  shopping: 'sustainable-fashion',
  money: 'british-coins,savings',
  tech: 'smartphone-repair',
  water: 'rainwater,garden',
  waste: 'recycling,compost',
  carbon: 'pine-forest',
}

const GENERAL_KEYWORD = 'minimalist-lifestyle,eco-friendly'

export type CardVariant = 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked'

/**
 * Get deterministic Unsplash image URL for a journey and card variant.
 * card-compact and card-liked always return null.
 */
export function getJourneyImage(
  journey: JourneyId,
  variant: CardVariant,
  _index: number = 0
): string | null {
  if (variant === 'card-compact' || variant === 'card-liked') {
    return null
  }

  const keyword = JOURNEY_KEYWORDS[journey] ?? GENERAL_KEYWORD
  return `${UNSPLASH_BASE}?${keyword}`
}
