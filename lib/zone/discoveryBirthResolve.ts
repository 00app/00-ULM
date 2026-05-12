/**
 * Shared discovery birth — Firecrawl/Gemini race + stored injection fallback.
 */

import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'
import type { DiscoveryBirthPayload } from '@/lib/agents/discoveryBirthRace'
import { raceDiscoveryBirth } from '@/lib/agents/discoveryBirthRace'
import { runDiscoveryStructuredPipeline } from '@/lib/agents/discoveryStructured'
import { runZeroHunterBirthAfterAnswer } from '@/lib/agents/zeroHunterBirth'
import { getStoredInjections } from '@/lib/zone/injectionStore'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'

export type FallbackMode = 'alternate-journey' | 'prefer-target'

export async function resolveDiscoveryBirthPayload(params: {
  targetJourney: JourneyId
  questionId: string
  answerValue: string
  postcode: string | null
  profileData: ResearchProfileData | null
  userId: string | null
  /** Journey user just answered — exclude matching cards when picking fallback tips. */
  currentJourneyForAlternate: JourneyId
  askedQuestionIds: string[]
  fallbackMode?: FallbackMode
}): Promise<DiscoveryBirthPayload | null> {
  const {
    targetJourney,
    questionId,
    answerValue,
    postcode,
    profileData,
    userId,
    currentJourneyForAlternate,
    askedQuestionIds,
    fallbackMode = 'alternate-journey',
  } = params

  let discoveryPayload = await raceDiscoveryBirth({
    structured: async () => {
      const s = await runDiscoveryStructuredPipeline({
        journeyId: targetJourney,
        questionId,
        answerValue,
        postcode,
        profileData,
        userId,
      })
      if (!s?.new_card_data) return null
      return {
        recommendation_copy: s.recommendation_copy,
        source_url: s.source_url,
        new_card_data: s.new_card_data,
      }
    },
    zeroHunter: async () => {
      const z = await runZeroHunterBirthAfterAnswer({
        journeyId: targetJourney,
        questionId,
        answerValue,
        postcode,
      })
      if (!z?.zoneCard) return null
      return {
        recommendation_copy:
          z.zoneCard.explanation?.[0] ??
          `${z.discoveryCard.value} — ${z.discoveryCard.title}`.toLowerCase(),
        source_url: z.discoveryCard.source_url,
        new_card_data: z.zoneCard,
      }
    },
    timeoutMs: 8000,
  })

  if (!discoveryPayload?.new_card_data) {
    const cards = getStoredInjections()
    const matchesRepeat = (card: ZoneTipCard) =>
      !!(card.followUp?.targetField && askedQuestionIds.includes(card.followUp.targetField))

    if (fallbackMode === 'prefer-target') {
      const picked =
        cards.find((card) => card.journey_key === targetJourney && !matchesRepeat(card)) ??
        cards.find((card) => card.journey_key === targetJourney) ??
        cards.find((card) => !matchesRepeat(card)) ??
        cards[0]
      if (picked) {
        discoveryPayload = {
          recommendation_copy:
            picked.explanation?.[0] ?? 'New discovery card from your question.',
          source_url: picked.cta?.url ?? picked.actions?.learnUrl ?? picked.source ?? '',
          new_card_data: picked,
        }
      }
    } else {
      const picked =
        cards.find(
          (card) =>
            card.journey_key !== currentJourneyForAlternate && !matchesRepeat(card)
        ) ??
        cards.find((card) => card.journey_key !== currentJourneyForAlternate) ??
        cards[0]
      if (picked) {
        discoveryPayload = {
          recommendation_copy:
            picked.explanation?.[0] ?? 'new discovery card birthed from your latest answer.',
          source_url: picked.cta?.url ?? picked.actions?.learnUrl ?? picked.source ?? '',
          new_card_data: picked,
        }
      }
    }
  }

  return discoveryPayload?.new_card_data ? discoveryPayload : null
}
