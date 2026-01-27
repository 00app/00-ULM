/**
 * Deterministic image selector for cards
 * Maps journey categories to static images
 */

import { JourneyId } from '@/lib/journeys'

/**
 * Get image path for a card variant and journey (existing behaviour)
 * Uses /public/cards/{journey}/{variant}.jpg
 */
export function getImageForCategory(
  journey: JourneyId,
  variant: 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked'
): string | null {
  if (variant === 'card-hero') {
    return `/cards/${journey}/hero.jpg`
  }
  if (variant === 'card-standard') {
    return `/cards/${journey}/standard.jpg`
  }
  // card-compact and card-liked never have images
  return null
}

/**
 * New helper: deterministic category image for hero-style cards
 * Uses /public/images/{category}.jpg
 */
export function getCategoryImage(category: JourneyId): string {
  switch (category) {
    case 'home':
      return '/images/home.jpg'
    case 'travel':
      return '/images/travel.jpg'
    case 'food':
      return '/images/food.jpg'
    case 'shopping':
      return '/images/shopping.jpg'
    case 'money':
      return '/images/money.jpg'
    case 'carbon':
      return '/images/carbon.jpg'
    case 'tech':
      return '/images/tech.jpg'
    case 'waste':
      return '/images/waste.jpg'
    case 'holidays':
      return '/images/holidays.jpg'
    default:
      return '/images/home.jpg'
  }
}

/**
 * Check if an image exists (for runtime checks)
 * Note: This is a best-effort check, actual 404s will be handled by the browser
 */
export function hasImage(journey: JourneyId, variant: 'card-hero' | 'card-standard'): boolean {
  const path = getImageForCategory(journey, variant)
  return path !== null
}
