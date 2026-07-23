/**
 * Shared discovery birth — Firecrawl/Gemini race + stored injection fallback.
 *
 * This used to be one of TWO separate orchestrators doing the same job: this file (used by
 * POST /api/zone/injections and POST /api/research/question-card) and a second, inline race
 * built directly inside POST /api/answers with its own hybrid/rebirthVault arms and timeout.
 * Both wrapped the same lower-level `raceDiscoveryBirth`, just with different arms wired up.
 * The `hybrid`/`structured`/`rebirthVault`/`timeoutMs` params below are optional precisely so
 * the two existing callers (which never pass them) keep their exact original behavior —
 * `structured` defaults to the Gemini pipeline exactly as before, `timeoutMs` still defaults to
 * 8000 — while /api/answers can now pass its own arms through this one shared function instead
 * of maintaining a second copy of the race-plus-fallback logic.
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
  /** Optional extra race arm — /api/answers' hybrid (processCalculatedLoopSpawn) path. Omitted by default. */
  hybrid?: () => Promise<DiscoveryBirthPayload | null>
  /** Override the default Gemini `structured` arm entirely (e.g. /api/answers swaps in a
   *  deterministic-only version while hybrid mode is active). Defaults to runDiscoveryStructuredPipeline. */
  structured?: () => Promise<DiscoveryBirthPayload | null>
  /** Optional extra race arm — /api/answers' Action-Vault-scrape high-impact path. Omitted by default. */
  rebirthVault?: () => Promise<DiscoveryBirthPayload | null>
  /** Race timeout in ms. Defaults to 8000 (existing behavior for the two original callers). */
  timeoutMs?: number
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
    hybrid,
    structured,
    rebirthVault,
    timeoutMs = 8000,
  } = params

  let discoveryPayload = await raceDiscoveryBirth({
    hybrid,
    structured:
      structured ??
      (async () => {
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
      }),
    zeroHunter: async () => {
      const z = await runZeroHunterBirthAfterAnswer({
        journeyId: targetJourney,
        questionId,
        answerValue,
        postcode,
        tenure: profileData?.tenure,
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
    rebirthVault,
    timeoutMs,
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
