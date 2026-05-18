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
import { scrapeSyncBearerMatches } from '@/lib/intelligence/scrapeSyncAuth'
import { buildAchievementDiscoveryCard } from '@/lib/discoveryInject'
import { isDeepLinkedUkOfferUrl } from '@/lib/zone/urlShield'

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
  user_id?: string
  question_id?: string
  answer_value?: string
  is_achievement_card?: boolean
  parent_answer_id?: string | null
  lifestyle_mode?: string
  source_url?: string
  offer_url?: string
  title?: string
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
    const hermesPush = scrapeSyncBearerMatches(request)
    const userId =
      session?.userId ??
      (hermesPush && typeof body.user_id === 'string' ? body.user_id.trim() : '')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAchievement =
      body.is_achievement_card === true ||
      String(body.lifestyle_mode ?? '').toLowerCase() === 'lifestyle_shift' ||
      String(body.lifestyle_mode ?? '').toLowerCase() === 'shift'

    const prior = await countDiscoveryInjectionsForUserJourney(userId, targetJourney)
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

    const loopQuestionId = normalizeString(body.question_id) || 'user_question'
    const loopAnswer = normalizeString(body.answer_value) || question.slice(0, 2000)

    let guarded = null as ReturnType<typeof enforceTrueWinRails> | null

    if (isAchievement && hermesPush) {
      const offer = normalizeString(body.offer_url ?? body.source_url)
      if (offer && !isDeepLinkedUkOfferUrl(offer)) {
        return NextResponse.json(
          {
            ok: false,
            birthed: false,
            reason: 'url-shield',
            url_shield: { ok: false, retry_recommended: true },
          },
          { status: 422 }
        )
      }
      const title = normalizeString(body.title) || question.slice(0, 140)
      guarded = buildAchievementDiscoveryCard({
        journeyId: targetJourney,
        questionId: loopQuestionId,
        answerValue: loopAnswer,
        title,
        offerUrl: offer || null,
      })
    } else {
      const discoveryPayload = await resolveDiscoveryBirthPayload({
        targetJourney,
        questionId: loopQuestionId,
        answerValue: loopAnswer,
        postcode,
        profileData,
        userId,
        currentJourneyForAlternate: targetJourney,
        askedQuestionIds: [],
        fallbackMode: 'prefer-target',
      })

      if (!discoveryPayload?.new_card_data) {
        return NextResponse.json({ ok: false, birthed: false, reason: 'no-card' }, { status: 404 })
      }

      guarded = enforceTrueWinRails(discoveryPayload.new_card_data)
    }

    if (!guarded) {
      return NextResponse.json({ ok: false, birthed: false, reason: 'no-card' }, { status: 404 })
    }
    const blockedByBoundary = !passesBoundaryGuard(guarded, postcode)
    if (blockedByBoundary) {
      return NextResponse.json({ ok: false, birthed: false, reason: 'boundary-guard' }, { status: 400 })
    }

    appendStoredInjections([guarded])
    persistZoneTipInjectBody({ cards: [guarded] })
    void persistDiscoveryInjection(userId, guarded.id, guarded, 'research_question_card', {
      journey_key: targetJourney,
      question_id: loopQuestionId,
      answer_value: loopAnswer,
      is_achievement_card: isAchievement,
      parent_answer_id:
        typeof body.parent_answer_id === 'string' ? body.parent_answer_id.trim() : null,
      lifestyle_mode: isAchievement ? 'lifestyle_shift' : null,
    })

    return NextResponse.json({
      ok: true,
      birthed: true,
      target_journey: targetJourney,
      is_achievement_card: isAchievement,
      parent_answer_id: body.parent_answer_id ?? null,
      lifestyle_mode: isAchievement ? 'lifestyle_shift' : null,
      discovery: {
        new_card_data: guarded,
      },
      new_discovery_card: discoveryCardFromZoneTip(guarded),
    })
  } catch (error) {
    console.error('[research/question-card]', error)
    return NextResponse.json({ ok: false, error: 'question-card failed' }, { status: 500 })
  }
}
