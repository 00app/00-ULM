'use client'

import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import type { JourneyId } from '@/lib/journeys'
import { runSoloFocusAuditCompletionClient } from '@/lib/soloFocusAuditCompleteClient'
import type { SentinelMotherRecardPayload } from '@/lib/sentinel/recardTypes'
import {
  persistTier2AnswerLocal,
  runTier2MotherChildSwap,
} from '@/lib/zone/tier2RecursiveSpawner'
import { ensureProfileSession } from '@/lib/client/ensureProfileSession'
import { markAiRouteBlockedFromStatus } from '@/lib/intelligence/aiRouteClientGuard'

export type SoloFocusJourneyAnswerResult = {
  ok: boolean
  discoverySnap: { questionId: string; answerValue: string }
  discoveryWinLine: string | null
  morphCards: unknown[]
  researchAttribution: { headline?: string | null; supplied_by?: string | null } | null
  birthedZoneTitle: string | null
  gridContext: { intensity_g_per_kwh: number | null; cleaner_vs_2025_pct: number | null } | null
  homeSentinelRecard: SentinelMotherRecardPayload | null
}

function parseHomeSentinel(raw: unknown): SentinelMotherRecardPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as SentinelMotherRecardPayload
  const headline = typeof p.headline === 'string' ? p.headline.trim() : ''
  if (!headline) return null
  return p
}

/** Canonical Solo Focus journey answer — POST /api/answers + Tier 2 scrape refresh. */
export async function submitSoloFocusJourneyAnswer(opts: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  postcode: string | null | undefined
  profileData?: ResearchProfileData | null
  journeyAnswers?: Record<string, Record<string, string>> | null
  cardId?: string | null
}): Promise<SoloFocusJourneyAnswerResult> {
  const journeyId = opts.journeyId
  const questionId = opts.questionId.trim()
  const answerValue = String(opts.answerValue ?? '').trim()
  const pc = String(opts.postcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()

  persistTier2AnswerLocal({ journeyId, questionId, answer: answerValue })

  const empty: SoloFocusJourneyAnswerResult = {
    ok: false,
    discoverySnap: { questionId, answerValue },
    discoveryWinLine: null,
    morphCards: [],
    researchAttribution: null,
    birthedZoneTitle: null,
    gridContext: null,
    homeSentinelRecard: null,
  }

  let morphCards: unknown[] = []
  let discoveryWinLine: string | null = null
  let researchAttribution: SoloFocusJourneyAnswerResult['researchAttribution'] = null
  let birthedZoneTitle: string | null = null
  let gridContext: SoloFocusJourneyAnswerResult['gridContext'] = null
  let homeSentinelRecard: SentinelMotherRecardPayload | null = null
  let apiOk = false

  try {
    await ensureProfileSession()
    const res = await fetch('/api/answers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journey_key: journeyId,
        question_id: questionId,
        answer_value: answerValue,
        answer: answerValue,
        postcode: pc.length >= 4 ? pc : undefined,
        solo_focus: true,
      }),
    })
    if (res.status === 401 || res.status === 429) {
      markAiRouteBlockedFromStatus(res.status)
    }
    if (res.ok) {
      apiOk = true
      const data = (await res.json()) as Record<string, unknown>
      if (Array.isArray(data.morphCards)) morphCards = data.morphCards
      if (typeof data.discovery_win === 'string' && data.discovery_win.trim()) {
        discoveryWinLine = data.discovery_win.trim()
      }
      const attr = data.researchAttribution
      if (attr && typeof attr === 'object') {
        researchAttribution = attr as SoloFocusJourneyAnswerResult['researchAttribution']
      }
      const discovery = data.discovery as Record<string, unknown> | undefined
      const grid = data.grid_context as Record<string, unknown> | undefined
      if (grid) {
        gridContext = {
          intensity_g_per_kwh:
            typeof grid.intensity_g_per_kwh === 'number' ? grid.intensity_g_per_kwh : null,
          cleaner_vs_2025_pct:
            typeof grid.cleaner_vs_2025_pct === 'number' ? grid.cleaner_vs_2025_pct : null,
        }
      }
      homeSentinelRecard = parseHomeSentinel(data.sentinelMotherRefresh)
      const birthTitle =
        typeof (discovery?.new_card_data as { title?: string } | undefined)?.title === 'string'
          ? (discovery!.new_card_data as { title: string }).title.trim()
          : ''
      if (birthTitle) birthedZoneTitle = birthTitle
    }
  } catch {
    /* fall through to Tier 2 */
  }

  if (pc.length >= 4) {
    const tier2 = await runTier2MotherChildSwap({
      postcode: pc,
      category: journeyId,
      answer: answerValue,
      questionId,
    })
    if (tier2.ok && tier2.morphCard?.title?.trim()) {
      researchAttribution = {
        headline: tier2.morphCard.title.trim(),
        supplied_by: tier2.morphCard.architectSuppliedBy ?? null,
      }
    }
    if (!morphCards.length && tier2.morphCard) {
      morphCards = [tier2.morphCard]
    }
    apiOk = apiOk || tier2.ok
  }

  runSoloFocusAuditCompletionClient({
    journeyId,
    questionId,
    answerValue,
    postcode: pc || null,
    profileData: opts.profileData ?? undefined,
    journeyAnswers: opts.journeyAnswers ?? undefined,
    cardId: opts.cardId,
  })

  return {
    ok: apiOk,
    discoverySnap: { questionId, answerValue },
    discoveryWinLine,
    morphCards,
    researchAttribution,
    birthedZoneTitle,
    gridContext,
    homeSentinelRecard,
  }
}
