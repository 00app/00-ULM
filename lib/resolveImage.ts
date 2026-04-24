import { JourneyId } from '@/lib/journeys'

/**
 * Resolve deterministic card image path
 * - card-hero: /cards/{journey}/hero.jpg
 * - card-standard: /cards/{journey}/standard.jpg
 * - card-compact and card-liked: no image
 */
export function resolveCardImage(
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
