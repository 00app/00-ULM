import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { isJourneyComplete, isValidJourneyQuestion } from '@/lib/journeys'
import {
  getJourneyAnswersForUser,
  getLatestResearchCitation,
  getLatestResearchAttribution,
  persistDiscoveryInjection,
  upsertJourneyAnswerJsonb,
} from '@/lib/db/neon'
import pool from '@/lib/db'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import type { ImpactProfile } from '@/lib/brains/types'
import type { JourneyId } from '@/lib/journeys'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'
import { runDiscoveryStructuredPipeline } from '@/lib/agents/discoveryStructured'
import { generateDiscoveryWinWithGemini } from '@/lib/agents/discoveryWin'
import { runZeroHunterBirthAfterAnswer } from '@/lib/agents/zeroHunterBirth'
import { discoveryCardFromZoneTip } from '@/lib/types/discovery'
import { raceDiscoveryBirth } from '@/lib/agents/discoveryBirthRace'
import { applyAprilEco4UrgencyBadge } from '@/lib/agents/discoveryCardTweaks'
import {
  getNationalGridIntensityGPerKwh,
  gridCleanerPercentVs2025,
} from '@/lib/grid/nationalGridLive'
import { shouldBirthNightChargeCard, buildNightChargeDiscoveryCard } from '@/lib/agents/nightChargeBirth'
import { fetchNextDiscoveryCards } from '@/lib/agents/discoveryEngine'
import { enforceTrueWinRails, passesBoundaryGuard } from '@/lib/zone/trueWinRails'
import { getLocalData } from '@/lib/local/getLocalData'
import { prioritizeMorphCardsForProfileTags, prioritizeRegionalMorphCards } from '@/lib/zone/morphRegionalPriority'

import { triggerSupplementalResearch, type ResearchProfileData } from '@/lib/agents/researchAgent'
import { runHybridLiveZoneTipForAnswer } from '@/lib/agents/scraperAgent'
import { advanceHomeJourneySentinelAfterAnswer } from '@/lib/sentinel/runner'
import { resolveLiveUnitRatesForPostcode } from '@/lib/brains/liveEconomy'
import { normalizeEmploymentStatus } from '@/lib/brains/calculations'

/** v1.8.14 — Production lock: answers route must not initiate third-party messaging. */
const DISALLOW_OUTBOUND = true
void DISALLOW_OUTBOUND

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const answers = await getJourneyAnswersForUser(session.userId)
    return NextResponse.json({ answers })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch answers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = session.userId

    const body = await request.json()
    const {
      journey_id,
      journey_key,
      question_id,
      question_key,
      answer,
      answer_value,
    } = body

    const jKey = typeof (journey_key ?? journey_id) === 'string' ? (journey_key ?? journey_id).trim() : ''
    const qKey = typeof (question_key ?? question_id) === 'string' ? (question_key ?? question_id).trim() : ''
    const value = answer_value ?? answer

    if (!jKey || !qKey || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: journey_key (or journey_id), question_key (or question_id), answer (or answer_value)' },
        { status: 400 }
      )
    }

    if (!isValidJourneyQuestion(jKey, qKey)) {
      return NextResponse.json({ error: 'Invalid journey or question' }, { status: 400 })
    }

    const [answersBeforeUpsert, profileRow] = await Promise.all([
      getJourneyAnswersForUser(user_id),
      pool.query(
        'SELECT postcode, home_type, household, transport_baseline, name, age_group, employment_status FROM users WHERE id = $1',
        [user_id]
      ).then((r) =>
        r.rows[0] as
          | {
              postcode?: string
              home_type?: string
              household?: string
              transport_baseline?: string
              name?: string
              age_group?: string
              employment_status?: string | null
              goal?: string | null
            }
          | undefined
      ).catch(() => undefined),
    ])
    const postcodeNorm = profileRow?.postcode?.replace(/\s+/g, '').trim() ?? null
    const profileData = profileRow
      ? {
          postcode: profileRow.postcode ?? null,
          home_type: profileRow.home_type ?? null,
          household: profileRow.household ?? null,
          transport_baseline: profileRow.transport_baseline ?? null,
          employment_status: profileRow.employment_status ?? null,
        }
      : null
    const upsertPromise = upsertJourneyAnswerJsonb(user_id, jKey, qKey, String(value))
    const sourceCitationPromise = getLatestResearchCitation(postcodeNorm)
    const hybridLiveZoneTipPromise =
      jKey === 'home' &&
      qKey === 'energy_type' &&
      String(value).trim().toUpperCase() === 'GAS'
        ? runHybridLiveZoneTipForAnswer({
            journeyId: 'home',
            questionId: 'energy_type',
            answerValue: String(value),
            postcode: postcodeNorm,
            profileData,
          }).catch(() => null)
        : Promise.resolve(null)

    const discoveryRacePromise = (async () => {
      let payload: {
        recommendation_copy: string
        source_url: string
        new_card_data: import('@/lib/zone/buildZoneViewModel').ZoneTipCard
      } | null = null
      try {
        payload = await raceDiscoveryBirth({
          structured: async () => {
            const s = await runDiscoveryStructuredPipeline({
              journeyId: jKey as JourneyId,
              questionId: qKey,
              answerValue: String(value),
              postcode: postcodeNorm,
              profileData,
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
              journeyId: jKey as JourneyId,
              questionId: qKey,
              answerValue: String(value),
              postcode: postcodeNorm,
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
      } catch {
        payload = null
      }
      return payload
    })()

    // Synchronous response: recompute impact from DB and return new totals so UI can Zip-Shut without refetch
    const [sourceCitation, discoveryPayload, journeyAnswers, hybridLiveEarly] = await Promise.all([
      sourceCitationPromise,
      discoveryRacePromise,
      upsertPromise.then(() => getJourneyAnswersForUser(user_id)),
      hybridLiveZoneTipPromise,
    ])
    const profile: ImpactProfile | undefined = profileRow
      ? {
          name: profileRow.name,
          postcode: profileRow.postcode,
          household: profileRow.household,
          home_type: profileRow.home_type,
          transport_baseline: profileRow.transport_baseline,
          age: profileRow.age_group as ImpactProfile['age'],
          employment_status: normalizeEmploymentStatus(profileRow.employment_status ?? undefined),
        }
      : undefined

    const homeNowComplete = isJourneyComplete(
      'home',
      journeyAnswers as Record<JourneyId, Record<string, string>>
    )
    const homeWasComplete = isJourneyComplete(
      'home',
      answersBeforeUpsert as Record<JourneyId, Record<string, string>>
    )
    const homeJustFinished = jKey === 'home' && homeNowComplete && !homeWasComplete

    const canLiveResearch = Boolean(
      process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || process.env.FIRECRAWL_API_KEY?.trim()
    )
    if (canLiveResearch) {
      const researchPayload = {
        postcode: profileRow?.postcode ?? null,
        profileData: profileData as ResearchProfileData | null,
        persistToNeon: true as const,
      }
      if (homeJustFinished) {
        await triggerSupplementalResearch(researchPayload)
      } else {
        void triggerSupplementalResearch(researchPayload)
      }
    }

    const homeUnitRates = await resolveLiveUnitRatesForPostcode(profileRow?.postcode ?? null)
    const userImpact = buildUserImpact(
      { profile, journeyAnswers: journeyAnswers as Record<JourneyId, Record<string, string>> },
      { homeUnitRates }
    )

    const discoveryWinPromise = generateDiscoveryWinWithGemini({
      journeyId: jKey as JourneyId,
      questionId: qKey,
      answerValue: String(value),
      journeyAnswers: journeyAnswers as Record<JourneyId, Record<string, string>>,
      postcode: profileRow?.postcode?.replace(/\s+/g, '').trim() ?? null,
    })

    const intensityPromise = getNationalGridIntensityGPerKwh()

    /** Birth sequence: (1) Neon JSONB committed → (2) race discovery engines → (3) persist winner → (4) optional grid pulse card. */
    let discoveryPayloadFinal = discoveryPayload

    if (discoveryPayloadFinal?.new_card_data) {
      const cardTweaked = applyAprilEco4UrgencyBadge(discoveryPayloadFinal.new_card_data, {
        journeyId: jKey as JourneyId,
        questionId: qKey,
        answerValue: String(value),
      })
      const card = enforceTrueWinRails(cardTweaked)
      if (passesBoundaryGuard(card, postcodeNorm)) {
        discoveryPayloadFinal = { ...discoveryPayloadFinal, new_card_data: card }
        persistZoneTipInjectBody({ cards: [card] })
        void persistDiscoveryInjection(user_id, card.id, card, 'discovery_race')

      } else {
        discoveryPayloadFinal = null
      }
    }

    const intensityG = await intensityPromise
    const grid_cleaner_pct = gridCleanerPercentVs2025(intensityG)

    let nextData: { cards: import('@/lib/zone/buildZoneViewModel').ZoneTipCard[] } | null = null
    try {
      nextData = await fetchNextDiscoveryCards(
        user_id,
        jKey,
        qKey,
        String(value),
        postcodeNorm,
        profileData as Record<string, unknown> | null
      )
    } catch {
      /* morph deck may still use discovery-only cards */
    }

    const morphFromEngine = nextData?.cards ?? []
    const morphFromDiscovery = discoveryPayloadFinal?.new_card_data ? [discoveryPayloadFinal.new_card_data] : []
    let morphCards = [...morphFromDiscovery, ...morphFromEngine]

    /* NextWin/OpenClaw morph cards were only returned in JSON — not persisted. Persist so Zone
       injections + client refresh match Solo Focus morph deck when the discovery race is empty or slow. */
    for (const raw of morphFromEngine) {
      try {
        const bounded = enforceTrueWinRails(raw)
        if (!passesBoundaryGuard(bounded, postcodeNorm)) continue
        persistZoneTipInjectBody({ cards: [bounded] })
        void persistDiscoveryInjection(user_id, bounded.id, bounded, 'next_win_invoke')
      } catch {
        /* ignore malformed morph row */
      }
    }

    const hybridLive = hybridLiveEarly
    if (hybridLive?.card) {
      const bounded = enforceTrueWinRails(hybridLive.card)
      const learn = bounded.actions?.learnUrl ?? ''
      const hasSame =
        learn && morphCards.some((c) => (c.actions?.learnUrl ?? '') === learn)
      if (!hasSame) {
        morphCards = [bounded, ...morphCards]
        if (passesBoundaryGuard(bounded, postcodeNorm)) {
          persistZoneTipInjectBody({ cards: [bounded] })
          void persistDiscoveryInjection(user_id, bounded.id, bounded, 'hybrid_live_scrape')
        }
      }
    }

    let grid_pulse_card: import('@/lib/zone/buildZoneViewModel').ZoneTipCard | undefined
    if (shouldBirthNightChargeCard(intensityG)) {
      const nc = buildNightChargeDiscoveryCard()
      if (nc) {
        const bounded = enforceTrueWinRails(nc)
        if (passesBoundaryGuard(bounded, postcodeNorm)) {
          persistZoneTipInjectBody({ cards: [bounded] })
          grid_pulse_card = bounded
          void persistDiscoveryInjection(user_id, bounded.id, bounded, 'night_charge_grid')
        }
      }
    }

    const discovery_win = await discoveryWinPromise

    const new_discovery_card = discoveryPayloadFinal?.new_card_data
      ? discoveryCardFromZoneTip(discoveryPayloadFinal.new_card_data)
      : undefined

    const baseResearchAttribution = await getLatestResearchAttribution(postcodeNorm)
    const researchAttribution =
      hybridLive?.researchAttribution != null
        ? {
            headline: hybridLive.researchAttribution.headline ?? baseResearchAttribution?.headline ?? null,
            supplied_by:
              hybridLive.researchAttribution.supplied_by ?? baseResearchAttribution?.supplied_by ?? null,
          }
        : baseResearchAttribution

    let regionForMorph: string | null = null
    if (postcodeNorm && postcodeNorm.length >= 4) {
      try {
        const loc = await getLocalData(postcodeNorm)
        regionForMorph = loc?.country || loc?.region || loc?.council || null
      } catch {
        regionForMorph = null
      }
    }
    const profileTags = [
      profileRow?.transport_baseline ?? '',
      profileRow?.home_type ?? '',
      ...(Object.values((journeyAnswers as Record<string, Record<string, string>>).travel ?? {}) as string[]),
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
    morphCards = prioritizeMorphCardsForProfileTags(morphCards, profileTags)
    morphCards = prioritizeRegionalMorphCards(morphCards, regionForMorph)

    let sentinelMotherRefresh: Awaited<ReturnType<typeof advanceHomeJourneySentinelAfterAnswer>> = null
    if (jKey === 'home') {
      try {
        sentinelMotherRefresh = await advanceHomeJourneySentinelAfterAnswer(pool, user_id)
      } catch {
        sentinelMotherRefresh = null
      }
    }

    if (
      jKey === 'home' &&
      qKey === 'energy_type' &&
      String(value).trim().toUpperCase() === 'GAS' &&
      postcodeNorm?.toUpperCase().startsWith('KW')
    ) {
      const scotGrantUrl = 'https://www.homeenergyscotland.org/funding-grants/heat-pump-grants-loans/'
      const scotGrantCard = {
        id: `inject-home-kw-gas-grant-${Date.now()}`,
        variant: 'card-compact' as const,
        title: 'scottish heat pump uplift',
        journey_key: 'home' as const,
        category: 'home' as const,
        data: { money: '£9,000', carbon: '1.2T CO₂' },
        source: scotGrantUrl,
        sourceLabel: 'source. home energy scotland',
        explanation: ['Up to £7,500 plus a £1,500 rural uplift is available for eligible KW households.'],
        actions: {
          actionType: 'apply' as const,
          learnUrl: scotGrantUrl,
          actionUrl: scotGrantUrl,
        },
        cta: { label: 'Check eligibility', url: scotGrantUrl },
        architectSuppliedBy: 'HOME ENERGY SCOTLAND',
        dominant_win: 'money' as const,
      }
      morphCards = [scotGrantCard, ...morphCards.filter((c) => c.actions?.learnUrl !== scotGrantUrl)]
    }

    return NextResponse.json({
      success: true,
      newTotals: userImpact.totals,
      sourceCitation: sourceCitation ?? undefined,
      researchAttribution: researchAttribution ?? undefined,
      discovery: discoveryPayloadFinal ?? undefined,
      discovery_win,
      new_discovery_card,
      morphCards,
      sentinelMotherRefresh: sentinelMotherRefresh ?? undefined,
      liveScrapeProvenance: hybridLive
        ? {
            url: hybridLive.scrapedUrl,
            mode: 'hybrid_firecrawl_gemini' as const,
            source_url: hybridLive.scrapedUrl,
            verified_date: 'April 2026',
          }
        : undefined,
      grid_context: {
        intensity_g_per_kwh: intensityG,
        cleaner_vs_2025_pct: grid_cleaner_pct,
      },
      grid_pulse_card,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to save answer' },
      { status: 500 }
    )
  }
}
