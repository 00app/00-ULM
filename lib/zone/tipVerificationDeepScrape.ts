/**
 * Tip +1 answer → scoped scrape-sync with repair pass (Estimated → Verified).
 */

import type { JourneyId } from '@/lib/journeys'
import {
  fetchTier2ScrapeSync,
  persistTier2AnswerLocal,
  refreshZoneTotalsAfterTier2,
  type Tier2ScrapeSyncResult,
} from '@/lib/zone/tier2RecursiveSpawner'

export async function runTipVerificationDeepScrape(params: {
  postcode: string
  journeyKey: JourneyId
  questionId: string
  answer: string
}): Promise<Tier2ScrapeSyncResult> {
  const pc = params.postcode.replace(/\s+/g, '').trim().toUpperCase()
  const category = params.journeyKey
  const answer = params.answer.trim()
  if (pc.length < 4 || !answer) {
    return {
      ok: false,
      category,
      coverage: null,
      meta: null,
      morphCard: null,
      offerUrl: null,
    }
  }

  persistTier2AnswerLocal({
    journeyId: category,
    questionId: params.questionId,
    answer,
  })

  const result = await fetchTier2ScrapeSync({
    postcode: pc,
    category,
    answer,
    questionId: params.questionId,
    repair: true,
  })

  if (result.ok) {
    await refreshZoneTotalsAfterTier2(pc)
  }

  return result
}
