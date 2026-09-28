/**
 * Shared persistence for POST /api/zone/tips-inject and POST /api/answers discovery injections.
 */

import { validateInjectionCards } from '@/lib/zone/injections'
import { appendStoredInjections } from '@/lib/zone/injectionStore'

const MAX_CARDS = 6

/** Parse JSON body like `{ cards: [...] }` and append validated tips to the zone injection store,
 *  under `key` (a specific person's scope key, or `GLOBAL_INJECTION_KEY` for a true broadcast). */
export function persistZoneTipInjectBody(body: unknown, key: string): number {
  if (!body || typeof body !== 'object') return 0
  const raw = Array.isArray((body as { cards?: unknown }).cards)
    ? (body as { cards: unknown[] }).cards
    : Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : []
  const cards = validateInjectionCards(raw)
  if (cards.length === 0) return 0
  appendStoredInjections(key, cards.slice(0, MAX_CARDS))
  return Math.min(cards.length, MAX_CARDS)
}
