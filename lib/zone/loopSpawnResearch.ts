import type { JourneyId } from '@/lib/journeys'
import { JOURNEYS } from '@/lib/journeys'
import {
  runTriggerResearchForCategory,
  type ResearchProfileData,
} from '@/lib/agents/researchAgent'

/** Surgical Firecrawl + Gemini context after a single loop answer (Level 2 → 3 spawn). */
export function buildLoopSpawnUserContext(params: {
  postcode: string
  journeyId: JourneyId
  questionId: string
  answerValue: string
  profileData?: ResearchProfileData | null
}): string {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const def = JOURNEYS[params.journeyId]
  const q = def?.questions.find((row) => row.id === params.questionId)
  const qLabel = q?.label ?? params.questionId
  const pd = params.profileData ?? {}
  return [
    'Loop spawn (answer-triggered research pass).',
    `postcode: ${pc}`,
    `category: ${params.journeyId}`,
    `question: ${qLabel}`,
    `answer: ${params.answerValue}`,
    `home_type: ${pd.home_type ?? '—'}`,
    `transport: ${pd.transport_baseline ?? '—'}`,
    `household: ${pd.household ?? '—'}`,
    `Emit up to three hyper-specific UK savings opportunities for this answer (grants, installers, tariffs). Reference ${pc} when locality matters.`,
  ].join('\n')
}

export async function runLoopSpawnResearch(params: {
  userId?: string | null
  postcode?: string | null
  journeyId: JourneyId
  questionId: string
  answerValue: string
  profileData?: ResearchProfileData | null
}) {
  const pc = params.postcode?.replace(/\s+/g, '').trim() ?? ''
  if (pc.length < 4) return null
  const userContext = buildLoopSpawnUserContext({
    postcode: pc,
    journeyId: params.journeyId,
    questionId: params.questionId,
    answerValue: params.answerValue,
    profileData: params.profileData,
  })
  const profileData: ResearchProfileData = {
    ...(params.profileData ?? {}),
    postcode: pc,
  }
  return runTriggerResearchForCategory({
    postcode: pc,
    category: params.journeyId,
    profileData,
    userId: params.userId ?? null,
    userContext,
  })
}
