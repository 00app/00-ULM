/**
 * Zone injections — stored tips for Zone grid.
 */

import { NextRequest, NextResponse } from 'next/server'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { getSessionFromRequest } from '@/lib/auth'
import {
  appendStoredInjections,
  getStoredInjections,
} from '@/lib/zone/injectionStore'
import { POST as refreshZoneTips } from '@/app/api/zone/tips-refresh/route'
import { raceDiscoveryBirth } from '@/lib/agents/discoveryBirthRace'
import { runDiscoveryStructuredPipeline } from '@/lib/agents/discoveryStructured'
import { runZeroHunterBirthAfterAnswer } from '@/lib/agents/zeroHunterBirth'
import { enforceTrueWinRails, passesBoundaryGuard } from '@/lib/zone/trueWinRails'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'
import { persistDiscoveryInjection } from '@/lib/db/neon'
import { discoveryCardFromZoneTip } from '@/lib/types/discovery'

export const dynamic = 'force-dynamic'

export async function GET() {
  let cards = getStoredInjections()
  if (cards.length === 0) {
    await refreshZoneTips()
    cards = getStoredInjections()
  }
  return NextResponse.json(cards)
}

interface BirthRequestBody {
  journey_id?: string
  journey_key?: string
  question_id?: string
  question_key?: string
  answer?: string
  answer_value?: string
  postcode?: string | null
  profileData?: {
    postcode?: string | null
    home_type?: string | null
    household?: string | null
    transport_baseline?: string | null
    goal?: string | null
  } | null
  asked_question_ids?: string[]
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
    const body = (await request.json().catch(() => ({}))) as BirthRequestBody
    const journeyRaw = normalizeString(body.journey_key ?? body.journey_id)
    const questionId = normalizeString(body.question_key ?? body.question_id)
    const answerValue = normalizeString(body.answer_value ?? body.answer)
    const askedQuestionIds = normalizeAskedQuestionIds(body.asked_question_ids)

    if (!journeyRaw || !questionId || !answerValue) {
      return NextResponse.json(
        { error: 'Missing required fields: journey_key, question_key, answer_value' },
        { status: 400 }
      )
    }

    const currentJourney = (
      JOURNEY_ORDER.includes(journeyRaw as JourneyId)
        ? (journeyRaw as JourneyId)
        : JOURNEY_ORDER[0]
    )
    const birthedJourney = pickDifferentJourney(currentJourney)

    const postcode =
      normalizeString(body.postcode ?? body.profileData?.postcode) || null
    const profileData = body.profileData ?? null
    const session = await getSessionFromRequest().catch(() => null)

    // Step 1: Refresh tips deck so the loop always has fresh rails-backed cards.
    await refreshZoneTips()

    // Step 2: Birth race targeting a different journey from the one just answered.
    let discoveryPayload = await raceDiscoveryBirth({
      structured: async () => {
        const s = await runDiscoveryStructuredPipeline({
          journeyId: birthedJourney,
          questionId,
          answerValue,
          postcode,
          profileData,
          userId: session?.userId ?? null,
        })
        if (!s?.new_card_data) return null
        return {
          recommendation_copy: s.recommendation_copy,
          source_url: s.source_url,
          new_card_data: s.new_card_data,
        }
      },
      zeroHunter: async () => {
        const z = await runZeroHunterBirthAfterAnswer({
          journeyId: birthedJourney,
          questionId,
          answerValue,
          postcode,
        })
        if (!z?.zoneCard) return null
        return {
          recommendation_copy:
            z.zoneCard.explanation?.[0] ??
            `${z.discoveryCard.value} — ${z.discoveryCard.title}`.toLowerCase(),
          source_url: z.discoveryCard.source_url,
          new_card_data: z.zoneCard,
        }
      },
      timeoutMs: 8000,
    })

    // Step 3: Fallback to stored injection cards if race yielded nothing.
    if (!discoveryPayload?.new_card_data) {
      const cards = getStoredInjections()
      const picked =
        cards.find(
          (card) =>
            card.journey_key !== currentJourney &&
            !(
              card.followUp?.targetField &&
              askedQuestionIds.includes(card.followUp.targetField)
            )
        ) ??
        cards.find((card) => card.journey_key !== currentJourney) ??
        cards[0]
      if (picked) {
        discoveryPayload = {
          recommendation_copy:
            picked.explanation?.[0] ?? 'new discovery card birthed from your latest answer.',
          source_url: picked.cta?.url ?? picked.actions?.learnUrl ?? picked.source ?? '',
          new_card_data: picked,
        }
      }
    }

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
    console.error('[zone/injections] birth error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to birth discovery card' },
      { status: 500 }
    )
  }
}
