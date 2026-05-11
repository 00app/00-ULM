/**
 * Intelligence loop — user free-form question → targeted Firecrawl/Gemini discovery card.
 * Same persistence as POST /api/zone/injections; capped at MAX_DISCOVERY_INJECTIONS_PER_JOURNEY per journey.
 */

import { NextRequest, NextResponse } from 'next/server'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { getSessionFromRequest } from '@/lib/auth'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { POST as refreshZoneTips } from '@/app/api/zone/tips-refresh/route'
import { enforceTrueWinRails, passesBoundaryGuard } from '@/lib/zone/trueWinRails'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'
import {
  countDiscoveryInjectionsForUserJourney,
  persistDiscoveryInjection,
} from '@/lib/db/neon'
import { discoveryCardFromZoneTip } from '@/lib/types/discovery'
import { resolveDiscoveryBirthPayload } from '@/lib/zone/discoveryBirthResolve'
import { appendStoredInjections } from '@/lib/zone/injectionStore'
import { MAX_DISCOVERY_INJECTIONS_PER_JOURNEY } from '@/lib/intelligence/manifest'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

interface QuestionCardBody {
  journey_key?: string
  question?: string
  text?: string
  postcode?: string | null
  profileData?: ResearchProfileData | null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as QuestionCardBody
    const journeyRaw = normalizeString(body.journey_key)
    const question = normalizeString(body.question ?? body.text)

    if (!question || question.length < 4) {
      return NextResponse.json({ error: 'Provide question (min 4 chars)' }, { status: 400 })
    }

    const targetJourney = (
      JOURNEY_ORDER.includes(journeyRaw as JourneyId) ? journeyRaw : 'home'
    ) as JourneyId

    const session = await getSessionFromRequest().catch(() => null)
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prior = await countDiscoveryInjectionsForUserJourney(session.userId, targetJourney)
    if (prior >= MAX_DISCOVERY_INJECTIONS_PER_JOURNEY) {
      return NextResponse.json(
        {
          ok: false,
          birthed: false,
          reason: 'max-injections-per-journey',
          limit: MAX_DISCOVERY_INJECTIONS_PER_JOURNEY,
        },
        { status: 429 }
      )
    }

    const postcode = normalizeString(body.postcode ?? body.profileData?.postcode) || null
    const profileData = (body.profileData ?? null) as ResearchProfileData | null

    await refreshZoneTips()

    const discoveryPayload = await resolveDiscoveryBirthPayload({
      targetJourney,
      questionId: 'user_question',
      answerValue: question.slice(0, 2000),
      postcode,
      profileData,
      userId: session.userId,
      currentJourneyForAlternate: targetJourney,
      askedQuestionIds: [],
      fallbackMode: 'prefer-target',
    })

    if (!discoveryPayload?.new_card_data) {
      return NextResponse.json({ ok: false, birthed: false, reason: 'no-card' }, { status: 404 })
    }

    const guarded = enforceTrueWinRails(discoveryPayload.new_card_data)
    const blockedByBoundary = !passesBoundaryGuard(guarded, postcode)
    if (blockedByBoundary) {
      return NextResponse.json({ ok: false, birthed: false, reason: 'boundary-guard' }, { status: 400 })
    }

    appendStoredInjections([guarded])
    persistZoneTipInjectBody({ cards: [guarded] })
    void persistDiscoveryInjection(session.userId, guarded.id, guarded, 'research_question_card')

    return NextResponse.json({
      ok: true,
      birthed: true,
      target_journey: targetJourney,
      discovery: {
        recommendation_copy: discoveryPayload.recommendation_copy,
        source_url: discoveryPayload.source_url,
        new_card_data: guarded,
      },
      new_discovery_card: discoveryCardFromZoneTip(guarded),
    })
  } catch (error) {
    console.error('[research/question-card]', error)
    return NextResponse.json({ ok: false, error: 'question-card failed' }, { status: 500 })
  }
}
