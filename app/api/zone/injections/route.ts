/**
 * Zone injections — stored tips for Zone grid.
 */

import { NextRequest, NextResponse } from 'next/server'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { getSessionFromRequest } from '@/lib/auth'
import { requireAiRouteAuth } from '@/lib/requestAuth'
import { appendStoredInjections, getStoredInjections } from '@/lib/zone/injectionStore'
import { POST as refreshZoneTips } from '@/app/api/zone/tips-refresh/route'
import { fallbackZoneTips } from '@/lib/zone/fallbackZoneTips'
import { setStoredInjections } from '@/lib/zone/injectionStore'
import { shouldSkipFirecrawlScrape } from '@/lib/intelligence/scrapeBoundaries'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { enforceTrueWinRails, passesBoundaryGuard, validateAndRailCards } from '@/lib/zone/trueWinRails'
import { validateInjectionCards } from '@/lib/zone/injections'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'
import {
  countDiscoveryInjectionsForUserJourney,
  persistDiscoveryInjection,
} from '@/lib/db/neon'
import { discoveryCardFromZoneTip } from '@/lib/types/discovery'
import { resolveDiscoveryBirthPayload } from '@/lib/zone/discoveryBirthResolve'
import { MAX_DISCOVERY_INJECTIONS_PER_JOURNEY } from '@/lib/intelligence/manifest'
import { invalidBodyResponse, zoneInjectionBirthBodySchema } from '@/lib/api/schemas'
import { captureServerError } from '@/lib/observability/captureError'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authDenied = await requireAiRouteAuth(request)
  if (authDenied) return authDenied

  let cards = getStoredInjections()
  if (cards.length === 0) {
    if (shouldSkipFirecrawlScrape()) {
      const fallback = validateAndRailCards(validateInjectionCards(fallbackZoneTips(null)), null)
      setStoredInjections(fallback)
    } else {
      await refreshZoneTips(request)
    }
    cards = getStoredInjections()
  }
  return NextResponse.json(cards)
}

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function normalizeAskedQuestionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

function pickDifferentJourney(currentJourney: JourneyId): JourneyId {
  const idx = JOURNEY_ORDER.indexOf(currentJourney)
  if (idx < 0) return JOURNEY_ORDER[0]
  return JOURNEY_ORDER[(idx + 1) % JOURNEY_ORDER.length]
}

/**
 * Discovery birth event endpoint.
 * Called after `/api/answers` commit to birth a new card and keep user in Solo Focus loop.
 */
export async function POST(request: NextRequest) {
  try {
    const authDenied = await requireAiRouteAuth(request)
    if (authDenied) return authDenied

    const rawBody = await request.json().catch(() => ({}))
    const parsed = zoneInjectionBirthBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return invalidBodyResponse(parsed.error)
    }
    const body = parsed.data
    const journeyRaw = normalizeString(body.journey_key ?? body.journey_id)
    const questionId = normalizeString(body.question_key ?? body.question_id)
    const answerValue = normalizeString(body.answer_value ?? body.answer)
    const askedQuestionIds = normalizeAskedQuestionIds(body.asked_question_ids)

    const currentJourney = (
      JOURNEY_ORDER.includes(journeyRaw as JourneyId)
        ? (journeyRaw as JourneyId)
        : JOURNEY_ORDER[0]
    )
    const birthedJourney = pickDifferentJourney(currentJourney)

    const postcode =
      normalizeString(body.postcode ?? body.profileData?.postcode) || null
    const profileData = (body.profileData ?? null) as ResearchProfileData | null
    const session = await getSessionFromRequest().catch(() => null)

    if (session?.userId) {
      const prior = await countDiscoveryInjectionsForUserJourney(session.userId, birthedJourney)
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
    }

    // Step 1: Refresh tips deck so the loop always has fresh rails-backed cards.
    await refreshZoneTips(request)

    // Step 2–3: Firecrawl/Gemini race + injection fallback (different journey than the one answered).
    const discoveryPayload = await resolveDiscoveryBirthPayload({
      targetJourney: birthedJourney,
      questionId,
      answerValue,
      postcode,
      profileData,
      userId: session?.userId ?? null,
      currentJourneyForAlternate: currentJourney,
      askedQuestionIds,
      fallbackMode: 'alternate-journey',
    })

    if (!discoveryPayload?.new_card_data) {
      return NextResponse.json(
        { ok: false, birthed: false, reason: 'no-card' },
        { status: 404 }
      )
    }

    // Step 4: Never-repeat guard + boundary rails.
    const guarded = enforceTrueWinRails(discoveryPayload.new_card_data)
    const blockedByRepeat =
      !!guarded.followUp?.targetField &&
      askedQuestionIds.includes(guarded.followUp.targetField)
    const blockedByBoundary = !passesBoundaryGuard(guarded, postcode)
    if (blockedByRepeat || blockedByBoundary) {
      return NextResponse.json({
        ok: false,
        birthed: false,
        reason: blockedByRepeat ? 'repeat-follow-up' : 'boundary-guard',
      })
    }

    // Step 5: Persist + return payload for DISCOVERY_INJECT_EVENT consumer.
    appendStoredInjections([guarded])
    persistZoneTipInjectBody({ cards: [guarded] })
    if (session?.userId) {
      void persistDiscoveryInjection(
        session.userId,
        guarded.id,
        guarded,
        'zone_injections_birth'
      )
    }

    return NextResponse.json({
      ok: true,
      birthed: true,
      current_journey: currentJourney,
      birthed_journey: guarded.journey_key,
      asked_question_ids: askedQuestionIds,
      discovery: {
        recommendation_copy: discoveryPayload.recommendation_copy,
        source_url: discoveryPayload.source_url,
        new_card_data: guarded,
      },
      new_discovery_card: discoveryCardFromZoneTip(guarded),
    })
  } catch (error) {
    captureServerError(error, { route: '/api/zone/injections', method: 'POST' })
    return NextResponse.json(
      { ok: false, error: 'Failed to birth discovery card' },
      { status: 500 }
    )
  }
}
