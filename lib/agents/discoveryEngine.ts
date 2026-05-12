import type { ZoneTipCard } from '@/lib/logic/zone'
import { researchNextWinAfterAnswer } from '@/lib/agents/nextWinInvoke'

/**
 * Birth the next live tip after an answer — Firecrawl-backed ZeroResearch + Gemini.
 */
export async function fetchNextDiscoveryCards(
  _userId: string,
  journeyId: string,
  questionId: string,
  answerValue: string,
  postcode: string | null,
  profileData: Record<string, unknown> | null
): Promise<{ cards: ZoneTipCard[] }> {
  try {
    const cards = await researchNextWinAfterAnswer({
      journeyId,
      questionId,
      answerValue,
      postcode,
      profileData,
    })
    return { cards }
  } catch (error) {
    console.error('[discoveryEngine] fetchNextDiscoveryCards:', error)
    return { cards: [] }
  }
}
