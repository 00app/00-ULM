/**
 * Legacy “next win” gateway path — disabled. Morph deck uses discovery engines + Neon research only.
 */
import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'

export async function researchNextWinAfterAnswer(_params: {
  journeyId: string
  questionId: string
  answerValue: string
  postcode: string | null
  profileData: Record<string, unknown> | null
}): Promise<ZoneTipCard[]> {
  void _params
  return []
}
