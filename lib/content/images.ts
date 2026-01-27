/**
 * Deterministic image mapping for Zone cards
 * Each journey has multiple images that rotate to avoid repetition
 */

import { JourneyId } from '@/lib/journeys'

export interface JourneyImageSet {
  hero: string[]
  standard: string[]
}

/**
 * Image sets per journey
 * Images are chosen by (journeyKey + card index) modulo array length
 * Hero card uses the first image for that journey
 * Standard cards rotate through the array
 */
export const JOURNEY_IMAGES: Record<JourneyId, JourneyImageSet> = {
  home: {
    hero: ['/cards/home/hero.jpg', '/cards/home/insulation.jpg', '/cards/home/boiler.jpg'],
    standard: [
      '/cards/home/standard.jpg',
      '/cards/home/thermostat.jpg',
      '/cards/home/energy-monitor.jpg',
      '/cards/home/led-lights.jpg',
    ],
  },
  travel: {
    hero: ['/cards/travel/hero.jpg', '/cards/travel/train.jpg', '/cards/travel/cycling.jpg'],
    standard: [
      '/cards/travel/standard.jpg',
      '/cards/travel/ev.jpg',
      '/cards/travel/walking.jpg',
      '/cards/travel/bus.jpg',
    ],
  },
  food: {
    hero: ['/cards/food/hero.jpg', '/cards/food/plant-meal.jpg', '/cards/food/local-produce.jpg'],
    standard: [
      '/cards/food/standard.jpg',
      '/cards/food/food-waste.jpg',
      '/cards/food/seasonal.jpg',
      '/cards/food/organic.jpg',
    ],
  },
  shopping: {
    hero: [
      '/cards/shopping/hero.jpg',
      '/cards/shopping/second-hand.jpg',
      '/cards/shopping/repair.jpg',
    ],
    standard: [
      '/cards/shopping/standard.jpg',
      '/cards/shopping/minimal.jpg',
      '/cards/shopping/reusable.jpg',
      '/cards/shopping/local-shop.jpg',
    ],
  },
  money: {
    hero: ['/cards/money/hero.jpg', '/cards/money/bills.jpg', '/cards/money/savings.jpg'],
    standard: [
      '/cards/money/standard.jpg',
      '/cards/money/budget.jpg',
      '/cards/money/switching.jpg',
      '/cards/money/investment.jpg',
    ],
  },
  carbon: {
    hero: [
      '/cards/carbon/hero.jpg',
      '/cards/carbon/footprint.jpg',
      '/cards/carbon/emissions.jpg',
    ],
    standard: [
      '/cards/carbon/standard.jpg',
      '/cards/carbon/data.jpg',
      '/cards/carbon/offset.jpg',
      '/cards/carbon/measure.jpg',
    ],
  },
  tech: {
    hero: [
      '/cards/tech/hero.jpg',
      '/cards/tech/energy-monitor.jpg',
      '/cards/tech/smart-home.jpg',
    ],
    standard: [
      '/cards/tech/standard.jpg',
      '/cards/tech/devices.jpg',
      '/cards/tech/repair.jpg',
      '/cards/tech/renewable.jpg',
    ],
  },
  waste: {
    hero: ['/cards/waste/hero.jpg', '/cards/waste/recycling.jpg', '/cards/waste/compost.jpg'],
    standard: [
      '/cards/waste/standard.jpg',
      '/cards/waste/reuse.jpg',
      '/cards/waste/repair.jpg',
      '/cards/waste/reduce.jpg',
    ],
  },
  holidays: {
    hero: [
      '/cards/holidays/hero.jpg',
      '/cards/holidays/train-travel.jpg',
      '/cards/holidays/staycation.jpg',
    ],
    standard: [
      '/cards/holidays/standard.jpg',
      '/cards/holidays/eco-hotel.jpg',
      '/cards/holidays/local.jpg',
      '/cards/holidays/sustainable.jpg',
    ],
  },
}

/**
 * Get image for a card based on journey and index
 * @param journey - Journey key
 * @param variant - Card variant
 * @param index - Card index in the render order (0-based)
 * @returns Image path or null
 */
export function getJourneyImage(
  journey: JourneyId,
  variant: 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked',
  index: number = 0
): string | null {
  // card-compact and card-liked never have images
  if (variant === 'card-compact' || variant === 'card-liked') {
    return null
  }

  const imageSet = JOURNEY_IMAGES[journey]
  if (!imageSet) {
    // Fallback: try simple path structure
    if (variant === 'card-hero') {
      return `/cards/${journey}/hero.jpg`
    }
    if (variant === 'card-standard') {
      return `/cards/${journey}/standard.jpg`
    }
    return null
  }

  if (variant === 'card-hero') {
    // Hero uses first image, or fallback to simple path
    return imageSet.hero[0] || `/cards/${journey}/hero.jpg`
  }

  if (variant === 'card-standard') {
    // Standard cards rotate through the array, or fallback to simple path
    const images = imageSet.standard
    if (images.length === 0) {
      return `/cards/${journey}/standard.jpg`
    }
    return images[index % images.length] || images[0] || `/cards/${journey}/standard.jpg`
  }

  return null
}

/**
 * Check if image path exists (fallback check)
 * Returns the path if it exists, null otherwise
 */
export function validateImagePath(path: string | null): string | null {
  if (!path) return null
  // For now, we assume all paths are valid
  // In production, you could check against a manifest or CDN
  return path
}
