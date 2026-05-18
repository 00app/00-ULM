/**
 * Client bridge: optimistic discovery card → Zone grid.
 * Safe to import from client components only (guards `window`).
 */

import type { JourneyId } from '@/lib/journeys'
import { validateInjectionCard } from '@/lib/zone/injections'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { buildAchievementDiscoveryCard } from '@/lib/zone/achievementDiscoveryCard'

export { buildAchievementDiscoveryCard } from '@/lib/zone/achievementDiscoveryCard'

export const DISCOVERY_INJECT_EVENT = 'zero-zero-discovery-inject'

/** Push a validated Zone tip card into the Zone page listener. */
export function injectNewDiscoveryCard(newCardData: unknown): ZoneTipCard | null {
  if (typeof window === 'undefined') return null
  const card = validateInjectionCard(newCardData)
  if (!card) return null
  window.dispatchEvent(new CustomEvent(DISCOVERY_INJECT_EVENT, { detail: card }))
  return card
}

export type AchievementPersistMeta = {
  journeyId: JourneyId
  questionId: string
  answerValue: string
}

/** Persist achievement card to injection store + Neon audit (non-blocking). */
export function persistAchievementCardRemote(card: ZoneTipCard, meta: AchievementPersistMeta): void {
  if (typeof window === 'undefined') return
  void fetch('/api/zone/injections/achievement', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card,
      journey_key: meta.journeyId,
      question_id: meta.questionId,
      answer_value: meta.answerValue,
    }),
  }).catch(() => {})
}

