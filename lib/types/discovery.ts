/**
 * Living Discovery Engine — API ↔ client contract for birthed Zone cards.
 */

import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'

/** Lightweight payload returned from POST /api/answers (alongside full `discovery.new_card_data`). */
export interface DiscoveryCard {
  id: string
  title: string
  /** Display string e.g. "SAVE £7,500" or "£117/yr" */
  value: string
  journey_key: JourneyId
  source_url: string
  /** Maps to a `JOURNEYS[journey_key].questions[].id` or followUp.targetField for the nested loop */
  nested_question_id: string | null
}

export function discoveryCardFromZoneTip(card: ZoneTipCard): DiscoveryCard {
  const money = (card.data?.money ?? '').trim()
  const value =
    money && /^save/i.test(money) ? money : money ? `SAVE ${money}` : 'SAVE —'
  const source_url =
    (typeof card.cta?.url === 'string' && card.cta.url) ||
    (typeof card.actions?.learnUrl === 'string' && card.actions.learnUrl) ||
    (typeof card.source === 'string' && card.source) ||
    ''
  return {
    id: card.id,
    title: card.title,
    value,
    journey_key: card.journey_key,
    source_url,
    nested_question_id: card.followUp?.targetField ?? null,
  }
}
