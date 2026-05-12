/**
 * Deterministic image mapping for Zone cards
 * Uses Unsplash via lib/utils/getJourneyImage (keyword + modifier).
 */

import { JourneyId } from '@/lib/journeys'
import { getJourneyImage as getJourneyImageUnsplash } from '@/lib/utils/getJourneyImage'

export type CardVariant = 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked'

/**
 * Get image URL for a card based on journey and variant (Single Source: Unsplash).
 * card-compact and card-liked always return null.
 */
export function getJourneyImage(
  journey: JourneyId,
  variant: CardVariant,
  index: number = 0
): string | null {
  return getJourneyImageUnsplash(journey, variant, index)
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
