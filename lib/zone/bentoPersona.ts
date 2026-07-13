import type { JourneyId } from '@/lib/journeys'

/** Bento cell shape — wide/tall only apply from tablet up (mobile forces 1×1). */
export type BentoPersona = 'square' | 'wide' | 'tall'

/**
 * Editorial utility map — asymmetric groovy wall (12 domains).
 * Hero span is applied separately via `bento-hero-span`.
 */
export const JOURNEY_BENTO_PERSONA: Record<JourneyId, BentoPersona> = {
  home: 'tall',
  utilities: 'wide',
  solar: 'wide',
  travel: 'tall',
  holidays: 'square',
  food: 'square',
  shopping: 'square',
  money: 'square',
  tech: 'square',
  water: 'square',
  waste: 'square',
  carbon: 'square',
}

export function bentoSpanClassForPersona(persona: BentoPersona): string {
  if (persona === 'wide') return 'span-wide'
  if (persona === 'tall') return 'span-tall'
  return ''
}
