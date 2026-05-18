/**
 * Persist a client-birthed achievement discovery card (pattern-shift close loop).
 * Appends to the injection store and `discovery_injections` when the user is signed in.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import {
  getJourneyAnswerRowId,
  persistDiscoveryInjection,
  upsertJourneyAnswerJsonb,
  upsertUserGenomeFromAnswer,
} from '@/lib/db/neon'
import { isValidJourneyQuestion, type JourneyId } from '@/lib/journeys'
import { validateInjectionCard } from '@/lib/zone/injections'
import { appendStoredInjections } from '@/lib/zone/injectionStore'

export const dynamic = 'force-dynamic'

type Body = {
  card?: unknown
  journey_key?: string
  question_id?: string
  answer_value?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null
    const card = validateInjectionCard(body?.card)
    if (!card) {
      return NextResponse.json({ ok: false, error: 'invalid card' }, { status: 400 })
    }
    card.achievement_discovery = true
    card.high_impact = true
    if (!card.badge) card.badge = 'NEW DISCOVERY'

    const journeyKey = String(body?.journey_key ?? card.journey_key ?? '').trim().toLowerCase()
    const questionId = String(body?.question_id ?? '').trim()
    const answerValue = String(body?.answer_value ?? '').trim()

    appendStoredInjections([card])

    const session = await getSessionFromRequest().catch(() => null)
    if (session?.userId && journeyKey && questionId && answerValue) {
      const jid = journeyKey as JourneyId
      if (isValidJourneyQuestion(jid, questionId)) {
        await upsertJourneyAnswerJsonb(session.userId, jid, questionId, answerValue).catch(() => {})
        void upsertUserGenomeFromAnswer(session.userId, jid, questionId, answerValue).catch(() => {})
      }
      const parentAnswerId = await getJourneyAnswerRowId(session.userId, journeyKey, questionId)
      void persistDiscoveryInjection(session.userId, card.id, card, 'achievement_takeover', {
        journey_key: journeyKey,
        question_id: questionId,
        answer_value: answerValue,
        is_achievement_card: true,
        parent_answer_id: parentAnswerId,
        lifestyle_mode: 'lifestyle_shift',
      })
    }

    return NextResponse.json({ ok: true, id: card.id })
  } catch (error) {
    console.error('[zone/injections/achievement] error:', error)
    return NextResponse.json({ ok: false, error: 'persist failed' }, { status: 500 })
  }
}
