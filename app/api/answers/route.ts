import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { isJourneyComplete, QUESTIONS_PER_JOURNEY } from '@/lib/journeys'
import { isValidLoopOrJourneyQuestion } from '@/lib/zone/loopQuestions'
import {
  getJourneyAnswersForUser,
  getLatestResearchCitation,
  getLatestResearchAttribution,
  persistDiscoveryInjection,
  upsertUserGenomeFromAnswer,
  upsertJourneyAnswerJsonb,
  canPersistUserDiscoveryInjection,
} from '@/lib/db/neon'
import pool from '@/lib/db'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import type { ImpactProfile } from '@/lib/brains/types'
import { isValidJourneyId, type JourneyId } from '@/lib/journeys'
import { runLoopSpawnResearch } from '@/lib/zone/loopSpawnResearch'
import { enrichResearchProfileFromSession } from '@/lib/intelligence/enrichProfileDataFromGenome'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'
import { generateDiscoveryWinWithGemini } from '@/lib/agents/discoveryWin'
import { discoveryCardFromZoneTip } from '@/lib/types/discovery'
import { resolveDiscoveryBirthPayload } from '@/lib/zone/discoveryBirthResolve'
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
import type { ZoneTipCard } from '@/lib/logic/zone'

async function maybePersistDiscoveryInjection(
  userId: string,
  card: ZoneTipCard,
  source: string,
  journeyFallback: string
): Promise<void> {
  const jk = String(card.journey_key ?? journeyFallback).trim().toLowerCase()
  if (!(await canPersistUserDiscoveryInjection(userId, jk, card.id))) return
  void persistDiscoveryInjection(userId, card.id, card, source, { journey_key: jk })
}

import {
  loadDynamicUserProfileForResearch,
  triggerSupplementalResearch,
  type ResearchProfileData,
} from '@/lib/agents/researchAgent'
import { updateHermesMemoryAfterAnswer } from '@/lib/agents/hermes-memory'
import { runRebirthVaultDiscovery } from '@/lib/agents/rebirthVaultDiscovery'
import { FIRECRAWL_API_KEY as resolvedFirecrawlKey } from '@/lib/sentinel/api-config'
import type { HybridLiveZoneTipResult } from '@/lib/agents/scraperAgent'
import { advanceHomeJourneySentinelAfterAnswer } from '@/lib/sentinel/runner'
import { resolveGridCarbonContextForPostcode } from '@/lib/brains/liveGridCarbonFactor'
import { resolveLiveUnitRatesForPostcode } from '@/lib/brains/liveEconomy'
import { normalizeEmploymentStatus } from '@/lib/brains/calculations'
import { attachSessionCookieToResponse, resolveAnswersUser } from '@/lib/answers/resolveAnswersUser'
import { answersPostBodySchema, invalidBodyResponse } from '@/lib/api/schemas'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import { tooManyRequestsResponse } from '@/lib/requestAuth'
import { captureServerError } from '@/lib/observability/captureError'
import { processCalculatedLoopSpawn } from '@/lib/zone/engineDataRouter'
import {
  isBucketFailoverMode,
  hasAnyResearchLlmProvider,
  shouldSkipFirecrawlScrape,
  shouldSkipGeminiInBucket,
} from '@/lib/intelligence/scrapeBoundaries'
import { buildDiscoveryInjectionId, buildDiscoveryInjectionCardAsync } from '@/lib/zone/discoveryCard'

/** Answers route does not send SMS — mobile welcome is `/api/profile/mobile` only. */

const ANSWERS_POST_MAX_PER_MINUTE = 15

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
    const id = getClientIdentifier(request)
    const { ok, retryAfter } = await checkRateLimitAsync(`answers-post:${id}`, ANSWERS_POST_MAX_PER_MINUTE)
    if (!ok) return tooManyRequestsResponse(retryAfter)

    const rawBody = await request.json()
    const bodyParsed = answersPostBodySchema.safeParse(rawBody)
    if (!bodyParsed.success) {
      return invalidBodyResponse(bodyParsed.error)
    }
    const body = bodyParsed.data
    const resolved = await resolveAnswersUser(request, rawBody as Record<string, unknown>)
    if (!resolved) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = resolved.userId
    const attachSession = resolved.attachSession

    const {
      journey_id,
      journey_key,
      question_id,
      question_key,
      answer,
      answer_value,
      solo_focus,
      postcode: bodyPostcodeRaw,
      user_id: _bodyUserId,
    } = body

    const jKey = (journey_key ?? journey_id ?? '').trim()
    const qKey = (question_key ?? question_id ?? '').trim()
    const value = answer_value ?? answer

    if (!jKey || !qKey || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: journey_key (or journey_id), question_key (or question_id), answer (or answer_value)' },
        { status: 400 }
      )
    }

    if (!isValidLoopOrJourneyQuestion(jKey, qKey)) {
      return NextResponse.json({ error: 'Invalid journey or question' }, { status: 400 })
    }

    const [answersBeforeUpsert, profileRow] = await Promise.all([
      getJourneyAnswersForUser(user_id),
      loadDynamicUserProfileForResearch(user_id).then((r) => r ?? undefined).catch(() => undefined),
    ])
    const profileGenome = (profileRow?.user_genome ?? {}) as Record<string, unknown>
    const tenureFromGenome = profileGenome.tenure ?? profileGenome.tenure_type ?? profileGenome.housing_tenure
    const hermesMemoryRaw = profileGenome.hermes_memory
    const hermesSkillFile =
      hermesMemoryRaw &&
      typeof hermesMemoryRaw === 'object' &&
      !Array.isArray(hermesMemoryRaw) &&
      typeof (hermesMemoryRaw as Record<string, unknown>).skill_file === 'string'
        ? String((hermesMemoryRaw as Record<string, unknown>).skill_file).slice(0, 6000)
        : null
    const householdSizeRaw = Number(profileGenome.household_size ?? profileGenome.householdSize)
    const householdSize =
      Number.isFinite(householdSizeRaw) && householdSizeRaw > 0 ? Math.round(householdSizeRaw) : null
    const openDataAnchor = profileGenome.open_data_anchor as { houseNumber?: string | null } | undefined
    const houseNumberFromGenome =
      typeof openDataAnchor?.houseNumber === 'string' && openDataAnchor.houseNumber.trim()
        ? openDataAnchor.houseNumber.trim()
        : typeof profileGenome.house_number === 'string' && profileGenome.house_number.trim()
          ? profileGenome.house_number.trim()
          : null
    const bodyPostcode =
      typeof bodyPostcodeRaw === 'string'
        ? bodyPostcodeRaw.replace(/\s+/g, '').trim().toUpperCase()
        : ''
    const profilePostcode = profileRow?.postcode?.replace(/\s+/g, '').trim().toUpperCase() ?? ''
    const postcodeNorm =
      bodyPostcode.length >= 4
        ? bodyPostcode
        : profilePostcode.length >= 4
          ? profilePostcode
          : null
    const profileDataBase = profileRow || postcodeNorm
      ? {
          postcode: postcodeNorm ?? profileRow?.postcode ?? null,
          house_number: houseNumberFromGenome,
          home_type: profileRow?.home_type ?? null,
          household: profileRow?.household ?? null,
          transport_baseline: profileRow?.transport_baseline ?? null,
          employment_status: profileRow?.employment_status ?? null,
          tenure: typeof tenureFromGenome === 'string' ? tenureFromGenome : null,
          household_size: householdSize != null ? String(householdSize) : null,
          hermes_skill_file: hermesSkillFile,
        }
      : null
    const profileData = profileDataBase
      ? enrichResearchProfileFromSession(profileDataBase, profileRow ?? null)
      : null
    const soloFocus =
      solo_focus === true ||
      solo_focus === 1 ||
      solo_focus === '1' ||
      solo_focus === 'true'

    const upsertPromise = upsertJourneyAnswerJsonb(user_id, jKey, qKey, String(value))
    const genomeUpsertPromise = upsertUserGenomeFromAnswer(user_id, jKey, qKey, String(value))
    const sourceCitationPromise = getLatestResearchCitation(postcodeNorm, user_id)
    const hybridLiveZoneTipPromise: Promise<HybridLiveZoneTipResult | null> = Promise.resolve(null)

    if (isValidJourneyId(jKey) && postcodeNorm && postcodeNorm.length >= 4) {
      void runLoopSpawnResearch({
        userId: user_id,
        postcode: postcodeNorm,
        journeyId: jKey,
        questionId: qKey,
        answerValue: String(value),
        profileData: profileData ?? null,
      }).catch((error) => {
        captureServerError(error, {
          route: '/api/answers',
          method: 'POST',
          tags: { context: 'runLoopSpawnResearch' },
          extra: { journeyId: jKey, questionId: qKey },
        })
      })
    }

    const hybridBirthEnabled =
      soloFocus && isBucketFailoverMode() && Boolean(postcodeNorm && postcodeNorm.length >= 4)

    const discoveryRacePromise = (async () => {
      let payload: {
        recommendation_copy: string
        source_url: string
        new_card_data: import('@/lib/logic/zone').ZoneTipCard
      } | null = null
      try {
        payload = await resolveDiscoveryBirthPayload({
          targetJourney: jKey as JourneyId,
          questionId: qKey,
          answerValue: String(value),
          postcode: postcodeNorm,
          profileData: profileData as ResearchProfileData | null,
          userId: user_id,
          // This route answers the CURRENT journey, so the "give me something rather than
          // nothing" stored-injection fallback should prefer a card for that same journey.
          currentJourneyForAlternate: jKey as JourneyId,
          askedQuestionIds: [],
          fallbackMode: 'prefer-target',
          hybrid: hybridBirthEnabled
              ? async () => {
                  const h = await processCalculatedLoopSpawn({
                    userId: user_id,
                    postcode: postcodeNorm!,
                    journeyKey: jKey,
                    questionId: qKey,
                    userAnswer: String(value),
                    profileData,
                  })
                  if (!h) return null
                  return {
                    recommendation_copy: h.architectProse.split(/\n\s*\n/)[0] ?? h.agentHeadline,
                    source_url: h.offerUrl,
                    new_card_data: h.zoneCard,
                  }
                }
              : undefined,
          // Only override the shared default `structured` arm (Gemini pipeline) when hybrid mode
          // is active, where a deterministic-only card is preferred instead — otherwise leave this
          // undefined so resolveDiscoveryBirthPayload's own runDiscoveryStructuredPipeline call runs,
          // instead of keeping a second copy of that same call here.
          structured: hybridBirthEnabled
            ? async () => {
                const stableId = buildDiscoveryInjectionId(
                  jKey as JourneyId,
                  qKey,
                  String(value)
                )
                const fallbackCard = await buildDiscoveryInjectionCardAsync(
                  jKey as JourneyId,
                  qKey,
                  String(value),
                  stableId
                )
                if (!fallbackCard) return null
                const copy =
                  (fallbackCard.explanation?.[0] ?? '').slice(0, 500) ||
                  'check gov.uk and energy saving trust for 2026 grants and tariffs that match your answer.'
                const source = fallbackCard.cta?.url ?? fallbackCard.source ?? 'https://www.gov.uk/'
                return {
                  recommendation_copy: copy,
                  source_url: source,
                  new_card_data: fallbackCard,
                }
              }
            : undefined,
          rebirthVault:
            soloFocus &&
            resolvedFirecrawlKey &&
            !shouldSkipFirecrawlScrape() &&
            hasAnyResearchLlmProvider() &&
            !shouldSkipGeminiInBucket()
              ? async () =>
                  runRebirthVaultDiscovery({
                    journeyId: jKey as JourneyId,
                    questionId: qKey,
                    answerValue: String(value),
                    postcode: postcodeNorm,
                    profileData: profileData as ResearchProfileData | null,
                    userId: user_id,
                  })
              : undefined,
          timeoutMs: soloFocus ? 14_000 : 8_000,
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
      Promise.all([upsertPromise, genomeUpsertPromise]).then(() => getJourneyAnswersForUser(user_id)),
      hybridLiveZoneTipPromise,
    ])
    const profile: ImpactProfile | undefined = profileRow
      ? {
          name: profileRow.name ?? undefined,
          postcode: profileRow.postcode ?? undefined,
          household: profileRow.household ?? undefined,
          home_type: profileRow.home_type ?? undefined,
          transport_baseline: profileRow.transport_baseline ?? undefined,
          age: profileRow.age_group as ImpactProfile['age'],
          employment_status: normalizeEmploymentStatus(profileRow.employment_status ?? undefined),
        }
      : undefined

    const journeyNowComplete = isValidJourneyId(jKey)
      ? isJourneyComplete(jKey as JourneyId, journeyAnswers as Record<JourneyId, Record<string, string>>)
      : false
    const journeyWasComplete =
      isValidJourneyId(jKey) &&
      isJourneyComplete(jKey as JourneyId, answersBeforeUpsert as Record<JourneyId, Record<string, string>>)
    const journeyJustFinished = journeyNowComplete && !journeyWasComplete

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
      process.env.DATABASE_URL?.trim() &&
        ((resolvedFirecrawlKey && !shouldSkipFirecrawlScrape()) || hasAnyResearchLlmProvider())
    )
    if (canLiveResearch && !hybridBirthEnabled) {
      const researchPayload = {
        postcode: profileRow?.postcode ?? null,
        profileData: profileData as ResearchProfileData | null,
        persistToNeon: true as const,
        userId: user_id,
        /** Pins `research_results.category` + Gemini What/Why/How triplet to this journey. */
        category: jKey,
      }
      if (homeJustFinished || journeyJustFinished) {
        await triggerSupplementalResearch(researchPayload)
      } else {
        void triggerSupplementalResearch(researchPayload)
      }
    } else if (canLiveResearch && hybridBirthEnabled && (homeJustFinished || journeyJustFinished)) {
      void triggerSupplementalResearch({
        postcode: profileRow?.postcode ?? null,
        profileData: profileData as ResearchProfileData | null,
        persistToNeon: true as const,
        userId: user_id,
        category: jKey,
      })
    }

    const [homeUnitRates, gridCarbon] = await Promise.all([
      resolveLiveUnitRatesForPostcode(profileRow?.postcode ?? null, {
        tariffType:
          (journeyAnswers as Record<string, Record<string, string>>).utilities?.tariff_type ?? null,
      }),
      resolveGridCarbonContextForPostcode(profileRow?.postcode ?? null),
    ])
    const userImpact = buildUserImpact(
      { profile, journeyAnswers: journeyAnswers as Record<JourneyId, Record<string, string>> },
      { homeUnitRates, gridIntensityGPerKwh: gridCarbon.intensityGPerKwh }
    )
    const hermesMemoryPromise = updateHermesMemoryAfterAnswer({
      userId: user_id,
      profile,
      journeyAnswers: journeyAnswers as Record<JourneyId, Record<string, string>>,
      userImpact,
      lastAnswer: {
        journeyId: jKey as JourneyId,
        questionId: qKey,
        answerValue: String(value),
      },
    }).catch(() => null)

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
        void maybePersistDiscoveryInjection(user_id, card, 'discovery_race', jKey)

      } else {
        discoveryPayloadFinal = null
      }
    }

    const intensityG = await intensityPromise
    const grid_cleaner_pct = gridCleanerPercentVs2025(intensityG)

    let nextData: { cards: import('@/lib/logic/zone').ZoneTipCard[] } | null = null
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

    /* NextWin morph cards were only returned in JSON — not persisted. Persist so Zone
       injections + client refresh match Solo Focus morph deck when the discovery race is empty or slow. */
    for (const raw of morphFromEngine) {
      try {
        const bounded = enforceTrueWinRails(raw)
        if (!passesBoundaryGuard(bounded, postcodeNorm)) continue
        persistZoneTipInjectBody({ cards: [bounded] })
        void maybePersistDiscoveryInjection(user_id, bounded, 'next_win_invoke', jKey)
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
          void maybePersistDiscoveryInjection(user_id, bounded, 'hybrid_live_scrape', jKey)
        }
      }
    }

    let grid_pulse_card: import('@/lib/logic/zone').ZoneTipCard | undefined
    if (shouldBirthNightChargeCard(intensityG)) {
      const nc = buildNightChargeDiscoveryCard()
      if (nc) {
        const bounded = enforceTrueWinRails(nc)
        if (passesBoundaryGuard(bounded, postcodeNorm)) {
          persistZoneTipInjectBody({ cards: [bounded] })
          grid_pulse_card = bounded
          void maybePersistDiscoveryInjection(user_id, bounded, 'night_charge_grid', jKey)
        }
      }
    }

    const discovery_win = await discoveryWinPromise
    const hermesMemory = await hermesMemoryPromise

    const new_discovery_card = discoveryPayloadFinal?.new_card_data
      ? discoveryCardFromZoneTip(discoveryPayloadFinal.new_card_data)
      : undefined

    const baseResearchAttribution = await getLatestResearchAttribution(postcodeNorm, user_id)
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

    const res = NextResponse.json({
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
      hermesMemory: hermesMemory ?? undefined,
      journey_just_finished: journeyJustFinished,
      questions_per_journey: QUESTIONS_PER_JOURNEY,
    })
    if (attachSession) {
      return attachSessionCookieToResponse(res, user_id)
    }
    return res
  } catch (error) {
    captureServerError(error, { route: '/api/answers', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to save answer' },
      { status: 500 }
    )
  }
}
