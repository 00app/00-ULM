import { JOURNEYS, JOURNEY_IDS, type JourneyId } from '@/lib/journeys'

export type QuestionType = 'options' | 'number'

export interface LockedQuestion {
  id: string
  question: string
  type: QuestionType
  options?: string[]
}

/** Mirrors `JOURNEYS` — 12 domains × 3 loop questions. */
export const JOURNEY_QUESTIONS: Record<JourneyId, LockedQuestion[]> = Object.fromEntries(
  JOURNEY_IDS.map((id) => [
    id,
    JOURNEYS[id].questions.map((q) => ({
      id: q.id,
      question: q.label,
      type: q.type,
      options: q.options,
    })),
  ])
) as Record<JourneyId, LockedQuestion[]>
