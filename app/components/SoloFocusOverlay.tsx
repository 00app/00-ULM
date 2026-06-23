'use client'

/**
 * Solo Focus expanded view — same content template as JourneyBentoCard expanded (kinetic grid).
 * Tips use this overlay; journey cards use JourneyBentoCard.
 * v1.8.3: portaled to `document.body`; QUESTION ↔ RESULT (140ms), source footer, insight/RESULT asterisk lock.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { type JourneyId, getOptionFullLabel } from '@/lib/journeys'
import { formatMoneyImpact, formatCarbonImpact, formatZoneCardMoney } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import {
  INDUSTRIAL_OPACITY_SNAP,
  INTRO_FADE_UP_NO_DELAY,
  FADE_VARIANTS,
  SHIMMER_FOCUS,
  soloFocusSlamMotionProps,
  SOLO_FOCUS_ZIP_SHUT_SEC,
  STACCATO_DURATION_SEC,
  STACCATO_EASE,
} from '@/lib/animations'
import { useCountUp } from '@/lib/utils/useCountUp'
import {
  parseMoneyGbpFromImpactDisplay,
  parseCarbonKgFromImpactDisplay,
} from '@/lib/soloFocusImpactParse'
import { AskZaiDeepDiveSheet } from '@/app/components/AskZaiDeepDiveSheet'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { SoloFocusJourneyNav } from '@/app/components/SoloFocusJourneyNav'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { useApp } from '@/app/context/AppContext'
import { syncSessionState } from '@/lib/sessionStateSync'
import {
  headlineFromExpandedHook,
  headlineFromRockHabit,
  headlineFromRockHabitForSoloFocus,
  formatZoneCategoryLabel,
  composeScrapedInsightDescription,
  buildResearchResultsTrueTipBody,
  isRawResearchDump,
  stripExpandedCardTitleNoise,
  wrapResultSupportingAsterisks,
  resolveSoloFocusHandoffUrls,
} from '@/lib/soloFocusCopy'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { estimateDiscoveryCarbonKg, ukAverageSavingForDiscoveryAnswer } from '@/lib/brains/calculations'
import { injectNewDiscoveryCard } from '@/lib/discoveryInject'
import { MotherCardRenderer } from '@/app/components/MotherCardRenderer'
import {
  PRICE_CAP_APRIL_2026,
  PRICE_CAP_MARCH_2026,
  PRICE_CAP_SAVING_APRIL_1,
  APRIL_2026_TRUTH_PENCE,
  APRIL_2026_STANDING_PENCE,
} from '@/lib/brains/constants'
import { normalizeCategoryToJourneyKey, trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import { useVisitedCardIds } from '@/lib/hooks/useVisitedCardIds'
import { applySessionProseVariety } from '@/lib/zone/sessionProseLedger'
import { resolveFocusCategoryJourneyId } from '@/lib/zone/focusCategory'
import {
  mergeMorphDeckIntoNavRing,
  type SoloFocusNavEntry,
} from '@/lib/zone/soloFocusJourneyNav'
import {
  resolveZoneSurfaceKind,
  zoneExpandedJourneySurfaceStyleProps,
  zoneSurfaceStyleProps,
} from '@/lib/journeyColors'
import { SoloFocusProseStack } from '@/app/components/SoloFocusProseStack'
import { SoloFocusMotherStack } from '@/app/components/SoloFocusMotherStack'
import { PulseExpandedSync } from '@/app/components/PulseExpandedSync'
import { SoloFocusViewportUtilityStrip } from '@/app/components/SoloFocusViewportUtilityStrip'
import { ExpandedCardShell } from '@/app/components/ExpandedCard'
import { pickPrimaryHttpUrl } from '@/lib/soloFocusDiagnosticMeta'
import { resolveSoloFocusHandoffAttribution } from '@/lib/soloFocusSuppliedBy'
import { prioritizeMorphCardsForContext } from '@/lib/locationMorphPrioritize'
import { useSoloFocusHudBodyClass } from '@/lib/hooks/useSoloFocusHudBodyClass'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import { getNextMorphCard } from '@/lib/zone/getNextMorphCard'
import {
  inferRevenueCtaKind,
  pickFirstHttpUrl,
  resolveRevenueCtaLabel,
} from '@/lib/zone/verifiedRevenue'
import {
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import { resolveBirthedCardId, scheduleSoloFocusRebirthOpen } from '@/lib/soloFocusRebirth'
import { bumpCategoryIntent } from '@/lib/zone/categoryIntent'
import { recordOfferSignal } from '@/lib/zone/offerSignals'
import {
  createSoloFocusEngagementRef,
  flushSoloFocusIndifferent,
  markSoloFocusEngagement,
} from '@/lib/zone/soloFocusEngagement'
import { isCardVisited } from '@/lib/zone/visitedCards'
import { isDiscoveryInjectCard, shouldCloseMarkPinkOnly } from '@/lib/zone/directorsOrder'
import { clearSoloFocusMemory } from '@/lib/zone/sessionMemory'
import type { PatternShiftCloseHandler } from '@/lib/zone/patternShiftClose'

export interface SoloFocusOverlayProps {
  category: string
  recommendation: string
  insight?: string
  moneyValue: string
  carbonValue: string
  offerUrl?: string
  /** Tip provenance — shown in Source footer until POST returns citation */
  sourceUrl?: string
  sourceLabel?: string
  /** Verified provider short name from Zone view model / Content Architect */
  architectSuppliedBy?: string | null
  onClose: () => void
  /** Close chevron → dismiss overlay, then pattern-shift takeover on Zone shell. */
  onPatternShiftClose?: PatternShiftCloseHandler
  cardId?: string
  onLike?: (id: string, title?: string, moneyGbp?: number) => void
  isLiked?: boolean
  journeyId?: JourneyId
  onJourneyAnswered?: () => void
  onSoloEmbedComplete?: (jid: JourneyId) => void
  title?: string
  discoveryFollowUp?: ZoneTipCard['followUp']
  onDiscoveryTrapComplete?: () => void
  startInQuestionMode?: boolean
  /** After POST /api/answers + RESULT (e.g. Rock: rotate slot / zip-shutter — not tied to Like). */
  onEmbeddedAnswerSuccess?: (info: { cardId?: string }) => void
  ctaLabel?: string
  /** v35.0 */
  partnerLink?: string | null
  verifiedSourceName?: string | null
  verifiedSourceDate?: string | null
  tipNeedsSwitching?: boolean
  isPriorityHome?: boolean
  /** v42.8 — when LIVE, header shows VERIFIED with locality even if title lacks prefix. */
  auditState?: 'LIVE_AUDIT' | 'ESTIMATED_AUDIT' | null
  /** Latest `research_results` row when category matches `journeyId` — £ + primary URL from Neon. */
  verifiedAuditMoneyGbp?: number | null
  verifiedAuditSourceUrl?: string | null
  verifiedAuditCategory?: string | null
  verifiedArchitectProse?: string | null
  /** Zone: per-journey `research_results` coverage from GET /api/scrape-sync. */
  researchCategoryCoverage?: Record<string, ResearchCategoryCoverageRow> | null
  /** True Tip / discovery card — show +1 verification question before handoff. */
  tipVerificationMode?: boolean
  /** Pink lock — deep scrape already earned; block re-spend. */
  isCardVisited?: boolean
  /** After verification scrape-sync + repair. */
  onTipVerificationComplete?: (detail: {
    moneyGbp: number
    carbonKg: number
    coverage: Record<string, ResearchCategoryCoverageRow> | null
  }) => void
  /** Linear wall-order rail (mother + discovery tips). */
  onNavigateJourney?: (journeyId: JourneyId) => void
  onNavigateSoloFocus?: (entry: import('@/lib/zone/soloFocusJourneyNav').SoloFocusNavEntry) => void
  soloFocusNavRing?: readonly import('@/lib/zone/soloFocusJourneyNav').SoloFocusNavEntry[]
  soloFocusJourneyRing?: readonly JourneyId[]
}

function triggerHaptic(p: 'light' | 'medium' | 'heavy') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    if (p === 'heavy') navigator.vibrate(25)
    else if (p === 'medium') navigator.vibrate(15)
    else navigator.vibrate(5)
  }
}

type OverlayViewState = 'QUESTION' | 'RESULT'

export function SoloFocusOverlay({
  category,
  recommendation,
  insight,
  moneyValue,
  carbonValue,
  offerUrl,
  sourceUrl,
  sourceLabel,
  architectSuppliedBy = null,
  onClose,
  onPatternShiftClose,
  cardId,
  onLike,
  isLiked = false,
  journeyId,
  onJourneyAnswered,
  onSoloEmbedComplete,
  title = recommendation,
  discoveryFollowUp,
  onDiscoveryTrapComplete,
  startInQuestionMode = false,
  onEmbeddedAnswerSuccess,
  ctaLabel,
  partnerLink,
  verifiedSourceName,
  verifiedSourceDate,
  tipNeedsSwitching = false,
  isPriorityHome = false,
  auditState = null,
  verifiedAuditMoneyGbp = null,
  verifiedAuditSourceUrl = null,
  verifiedAuditCategory = null,
  verifiedArchitectProse = null,
  researchCategoryCoverage = null,
  tipVerificationMode = false,
  isCardVisited: isCardVisitedProp = false,
  onTipVerificationComplete,
  onNavigateJourney,
  onNavigateSoloFocus,
  soloFocusNavRing,
  soloFocusJourneyRing,
}: SoloFocusOverlayProps) {
  useSoloFocusHudBodyClass(true)
  const { isUnreadCard } = useVisitedCardIds()

  const cardVisitedLock =
    isCardVisitedProp || (cardId?.trim() ? isCardVisited(cardId) : false)
  const { setHeroTotals, state, toggleLike, toggleDislike } = useApp()
  const profilePostcode = state.profile?.postcode ?? null
  const titleLooksEstimated = /^\s*ESTIMATED AUDIT\b/i.test(String(title ?? ''))
  const useEstimated =
    auditState === 'ESTIMATED_AUDIT' || (!auditState && titleLooksEstimated)
  const sfStorageKey = `zz_sf_view_${cardId ?? 'solo-overlay'}`
  const [viewState, setViewState] = useState<OverlayViewState>(() => {
    if (typeof window === 'undefined') return 'QUESTION'
    try {
      return sessionStorage.getItem(sfStorageKey) === 'RESULT' ? 'RESULT' : 'QUESTION'
    } catch {
      return 'QUESTION'
    }
  })
  const [loopZipCollapsing, setLoopZipCollapsing] = useState(false)
  const [resultCitation, setResultCitation] = useState<{
    label: string
    url?: string
    verifiedAt?: string
  } | null>(null)
  const [liveClaimUrl, setLiveClaimUrl] = useState<string | null>(null)
  const [discoverySnap, setDiscoverySnap] = useState<{ questionId: string; answerValue: string } | null>(null)
  const [geminiRecommendationCopy, setGeminiRecommendationCopy] = useState<string | null>(null)
  const [discoveryWinLine, setDiscoveryWinLine] = useState<string | null>(null)
  const [birthedZoneTitle, setBirthedZoneTitle] = useState<string | null>(null)
  const [gridContext, setGridContext] = useState<{
    intensity_g_per_kwh: number | null
    cleaner_vs_2025_pct: number | null
  } | null>(null)
  const [userContextSnap, setUserContextSnap] = useState<any>(null)
  const [soloEmbedQuestionLabel, setSoloEmbedQuestionLabel] = useState<string | null>(null)

  const [morphedCardsQueue, setMorphedCardsQueue] = useState<any[]>([])
  const [activeSiblingIndex, setActiveSiblingIndex] = useState(0)
  const [impactAnswerPulse, setImpactAnswerPulse] = useState(false)
  const [heroTotalsOverride, setHeroTotalsOverride] = useState<{ money: number; carbon: number } | null>(null)
  const [questionCount, setQuestionCount] = useState(0)
  /** Brief blank beat between last answer zip and RESULT. */
  const [spawnHandoffBlank, setSpawnHandoffBlank] = useState(false)
  /** Discovery trap: Firecrawl/Gemini birth in flight after answer tap. */
  const [discoveryBirthPending, setDiscoveryBirthPending] = useState(false)
  /** Pulse 3 — pink high-impact discovery card rebirth after final answer. */
  const [discoveryRebirthTip, setDiscoveryRebirthTip] = useState(false)
  const [rebirthDiscoveryTitle, setRebirthDiscoveryTitle] = useState<string | null>(null)
  const [askZaiDeepDiveOpen, setAskZaiDeepDiveOpen] = useState(false)
  const soloFocusEngagementRef = useRef(createSoloFocusEngagementRef())

  useEffect(() => {
    const core = cardId ?? journeyId ?? 'solo-overlay'
    const lk = `zz_sf_lane_${core}`
    const qk = `zz_sf_q_${core}`
    try {
      sessionStorage.removeItem(lk)
      sessionStorage.removeItem(qk)
    } catch {
      /* ignore */
    }
  }, [cardId, journeyId])

  const [reducePagerMotion, setReducePagerMotion] = useState(false)
  const overlayViewStatePrev = useRef<OverlayViewState>(viewState)
  const [researchAttribution, setResearchAttribution] = useState<{
    headline?: string | null
    supplied_by?: string | null
  } | null>(null)

  const deck = useMemo(
    () => [
      {
        isOriginal: true,
        category,
        heading: recommendation,
        description: insight,
        impactMoney: null as string | null,
        impactCarbon: null as string | null,
        url: offerUrl,
        sourceUrl,
        sourceLabel,
        architectSuppliedBy,
        title,
        journey_key: journeyId,
        id: cardId,
      },
      ...morphedCardsQueue,
    ],
    [
      category,
      recommendation,
      insight,
      offerUrl,
      sourceUrl,
      sourceLabel,
      architectSuppliedBy,
      title,
      journeyId,
      cardId,
      morphedCardsQueue,
    ]
  )
  const currentMorphData = deck[activeSiblingIndex] || deck[0]

  const displayCategory = currentMorphData?.category ?? category
  const displayRecommendation = currentMorphData?.heading ?? currentMorphData?.title ?? recommendation
  const displayInsight = currentMorphData?.description ?? insight
  const displayMoneyValue = currentMorphData?.impactMoney
    ? `£${currentMorphData.impactMoney}`
    : currentMorphData?.data?.money ?? (heroTotalsOverride ? `£${heroTotalsOverride.money}` : moneyValue)
  const displayCarbonValue = currentMorphData?.impactCarbon
    ? `${currentMorphData.impactCarbon}kg CO₂`
    : currentMorphData?.data?.carbon ?? (heroTotalsOverride ? `${heroTotalsOverride.carbon}kg CO₂` : carbonValue)
  const displayTitle = currentMorphData?.heading ?? currentMorphData?.title ?? title
  const displayJourneyId = currentMorphData?.journey_key ?? journeyId
  const focusCategoryJourneyId = resolveFocusCategoryJourneyId(journeyId, displayJourneyId)
  const zoneCategoryLabel = formatZoneCategoryLabel(focusCategoryJourneyId)

  const activeCardId = currentMorphData?.id ?? cardId

  useEffect(() => {
    soloFocusEngagementRef.current.current = 'none'
  }, [activeCardId, cardId])

  const soloFocusNavRingWithMorph = useMemo(() => {
    const morphNav = deck
      .filter((d) => Boolean(d?.id?.trim()))
      .filter((d, i) => i > 0 || d.id !== cardId)
    return mergeMorphDeckIntoNavRing(
      soloFocusNavRing ?? [],
      focusCategoryJourneyId,
      morphNav,
      cardId ?? undefined
    )
  }, [deck, cardId, soloFocusNavRing, focusCategoryJourneyId])

  const handleNavigateSoloFocusEntry = useCallback(
    (entry: SoloFocusNavEntry) => {
      const deckIdx = deck.findIndex((d) => d?.id === entry.cardId)
      if (deckIdx >= 0) {
        setActiveSiblingIndex(deckIdx)
        return
      }
      const motherId = journeyId ? `journey-${journeyId}` : cardId ?? ''
      if (motherId && entry.kind === 'journey' && entry.cardId === motherId) {
        setActiveSiblingIndex(0)
        return
      }
      onNavigateSoloFocus?.(entry)
    },
    [deck, cardId, journeyId, onNavigateSoloFocus]
  )

  const moneyTargetGbp = parseMoneyGbpFromImpactDisplay(displayMoneyValue)
  const carbonTargetKg = parseCarbonKgFromImpactDisplay(displayCarbonValue)
  const verifiedAuditMatchesJourney =
    verifiedAuditMoneyGbp != null &&
    Number.isFinite(verifiedAuditMoneyGbp) &&
    Boolean(journeyId) &&
    (verifiedAuditCategory ?? '').trim().toLowerCase() === String(journeyId).toLowerCase()
  const motherMoneyTargetGbp = verifiedAuditMatchesJourney ? verifiedAuditMoneyGbp : moneyTargetGbp
  const animatedMoneyGbp = useCountUp(motherMoneyTargetGbp, { duration: 520 })
  const animatedCarbonKg = useCountUp(carbonTargetKg, { duration: 520 })

  const morphLearnUrl =
    currentMorphData?.actions?.learnUrl && typeof currentMorphData.actions.learnUrl === 'string'
      ? currentMorphData.actions.learnUrl.trim()
      : ''
  const morphLearnResolved =
    morphLearnUrl ||
    (currentMorphData?.category
      ? trustedUrlForJourney(normalizeCategoryToJourneyKey(String(currentMorphData.category)))
      : '')

  const discoveryRecUrl =
    discoverySnap != null && journeyId
      ? (() => {
          const r = getDiscoveryRecommendation(journeyId, discoverySnap.questionId, discoverySnap.answerValue)
          return (
            [r.ctaUrl, r.actionUrl, r.learnUrl].find(
              (u) => typeof u === 'string' && u.trim().startsWith('http')
            ) ?? ''
          )
        })()
      : ''

  const isGenericHomepageUrl = (u: string): boolean => {
    try {
      const parsed = new URL(u)
      return parsed.pathname === '/' || parsed.pathname === ''
    } catch {
      return false
    }
  }
  const partnerHttp = pickFirstHttpUrl(partnerLink ?? undefined)
  const isRockHabitTip = String(cardId ?? activeCardId ?? '').startsWith('rock-')
  const covLookupKey = focusCategoryJourneyId
  const journeyResearchCov =
    covLookupKey && researchCategoryCoverage ? researchCategoryCoverage[covLookupKey] : undefined
  const overlayResearchSettled = journeyResearchSettled(journeyResearchCov, {
    journeyId: normalizeCategoryToJourneyKey(journeyId ?? 'home'),
  })
  const covOfferHttp =
    isRockHabitTip || !journeyResearchCov?.latestOfferUrl?.trim().startsWith('http')
      ? ''
      : journeyResearchCov.latestOfferUrl.trim()
  const covSourceHttp =
    isRockHabitTip || !journeyResearchCov?.latestSourceUrl?.trim().startsWith('http')
      ? ''
      : journeyResearchCov.latestSourceUrl.trim()
  const liveDiscoveryUrl =
    [
      covSourceHttp,
      covOfferHttp,
      liveClaimUrl,
      morphLearnResolved,
      resultCitation?.url,
      offerUrl,
      sourceUrl,
      discoveryRecUrl,
    ]
      .find(
        (u) => typeof u === 'string' && u.trim().length > 0 && !isGenericHomepageUrl(u.trim())
      )
      ?.trim()
  const buildZaiAuditUrl = (): string => {
    const journeyKey = String(displayJourneyId || journeyId || 'home')
    const context = `reclaim_${journeyKey}`
    const params = new URLSearchParams({
      context,
      journey: journeyKey,
      title: String(displayTitle || title || displayRecommendation || ''),
      money: String(Math.round(motherMoneyTargetGbp)),
      carbon: String(Math.round(carbonTargetKg)),
      source: String(sourceLabel || ''),
    })
    return `/zai?${params.toString()}`
  }
  /** `/zai` only when there is no `research_results` row for this category; otherwise prefer HTTP source / offer. */
  const allowZaiFallback = isRockHabitTip
    ? false
    : researchCategoryCoverage === undefined || researchCategoryCoverage === null
      ? true
      : journeyResearchCov == null
  const soloHandoff = resolveSoloFocusHandoffUrls({
    journeyKey: String(displayJourneyId || journeyId || 'home'),
    coverageOfferUrl: isRockHabitTip ? null : journeyResearchCov?.latestOfferUrl,
    coverageSourceUrl: isRockHabitTip ? null : journeyResearchCov?.latestSourceUrl,
    fallbackOfferUrl: pickPrimaryHttpUrl(offerUrl, liveDiscoveryUrl, partnerHttp),
    fallbackSourceUrl: pickPrimaryHttpUrl(sourceUrl, covSourceHttp),
    buildZaiUrl: () => (allowZaiFallback ? buildZaiAuditUrl() : ''),
  })
  const resolvedOpenUrl = soloHandoff.ctaUrl.trim()

  const effectiveTitleRaw =
    discoveryRebirthTip && rebirthDiscoveryTitle?.trim()
      ? rebirthDiscoveryTitle.trim()
      : currentMorphData
        ? String(displayTitle || displayRecommendation).trim() || displayRecommendation
        : researchAttribution?.headline?.trim() ||
          String(displayTitle || displayRecommendation || title).trim() ||
          displayRecommendation
  const isZoneMotherChild = !startInQuestionMode
  const overlayFocusJourney = normalizeCategoryToJourneyKey(String(displayJourneyId ?? journeyId ?? 'home'))
  const recommendationTitle = isRockHabitTip
    ? headlineFromRockHabitForSoloFocus(
        String(effectiveTitleRaw),
        (displayInsight ?? insight ?? '').trim() || undefined
      )
    : headlineFromExpandedHook(
        stripExpandedCardTitleNoise(String(effectiveTitleRaw)),
        overlayFocusJourney
      )
  let sourceName = sourceLabel
  if (!sourceName && resolvedOpenUrl) {
    try {
      if (resolvedOpenUrl.startsWith('http')) {
        sourceName = new URL(resolvedOpenUrl).hostname.replace('www.', '')
      }
    } catch {
      /* ignore */
    }
  }
  sourceName = sourceName || 'our partners'
  const handoffAttribution = resolveSoloFocusHandoffAttribution({
    ctaUrl: soloHandoff.ctaUrl,
    researchSuppliedBy: researchAttribution?.supplied_by,
    architectSuppliedBy,
    sourceLabel,
    sourceName,
    liveScrapeSourceUrl: soloHandoff.sourceLinkUrl || undefined,
  })
  const pulseSourceUrl =
    soloHandoff.ctaUrl?.trim().startsWith('http') ? soloHandoff.ctaUrl.trim() : soloHandoff.sourceLinkUrl
  const researchBackedTrueTip =
    !isRockHabitTip &&
    verifiedAuditMatchesJourney &&
    verifiedArchitectProse?.trim() &&
    !isRawResearchDump(verifiedArchitectProse)
      ? buildResearchResultsTrueTipBody({
          architectProse: verifiedArchitectProse.trim(),
          verifiedSavingGbp: motherMoneyTargetGbp,
          carbonKg: carbonTargetKg,
          journeyId: String(displayJourneyId ?? journeyId ?? 'home'),
        })
      : null
  const rawInsight = (displayInsight ?? insight ?? '').trim()
  const preSplitAuditor =
    rawInsight.includes('\n\n')
      ? rawInsight
          .split(/\n\s*\n/)
          .map((x: string) => x.trim())
          .filter(Boolean)
          .slice(0, 3)
      : []
  const scrapedOverlay =
    preSplitAuditor.length >= 3
      ? preSplitAuditor.join(' ')
      : composeScrapedInsightDescription([displayInsight ?? insight], 3).trim()
  const genericCopy = /answer a few questions|personalise your/i
  const insightDisplay =
    scrapedOverlay && !genericCopy.test(scrapedOverlay) ? scrapedOverlay : ''
  const insightParaSourceBase =
    researchBackedTrueTip?.trim() ??
    (preSplitAuditor.length >= 3
      ? preSplitAuditor.slice(0, 3).join('\n\n')
      : (insightDisplay || '').trim() || rawInsight)
  const insightParaSource =
    isRockHabitTip || typeof window === 'undefined' || !insightParaSourceBase.trim()
      ? insightParaSourceBase
      : applySessionProseVariety(insightParaSourceBase, {
          cardId: cardId ?? activeCardId ?? undefined,
          journeyId: (displayJourneyId ?? journeyId ?? 'home') as JourneyId,
          headline: recommendationTitle,
          moneyGbp: motherMoneyTargetGbp,
          carbonKg: carbonTargetKg,
          userPostcode: profilePostcode ?? state.profile?.postcode,
          sourceDisplayName: handoffAttribution.sourceDisplayName,
          auditHeaderLocality: state.locationState?.locationName ?? undefined,
        })
  const soloFocusCardId = cardId ?? activeCardId ?? (journeyId ? `journey-${journeyId}` : '')
  const showMotherComputing =
    !overlayResearchSettled && researchCategoryCoverage != null
  const isDiscoveryMotherCard = isDiscoveryInjectCard(cardId)
  const trueTipSectionsEl = !showMotherComputing ? (
    <SoloFocusProseStack
      headline={recommendationTitle}
      insightSource={insightParaSource}
      journeyId={String(displayJourneyId ?? journeyId ?? 'home')}
      moneyGbp={motherMoneyTargetGbp}
      carbonKg={carbonTargetKg}
      userPostcode={profilePostcode ?? state.profile?.postcode}
      sourceDisplayName={handoffAttribution.sourceDisplayName}
      auditHeaderLocality={state.locationState?.locationName ?? undefined}
      locality={state.locationState?.locationName ?? undefined}
      postcode={profilePostcode ?? state.profile?.postcode ?? undefined}
      contentMode={isRockHabitTip ? 'rock' : 'journey'}
      habitTitle={isRockHabitTip ? String(title || displayTitle || recommendation).trim() : undefined}
    />
  ) : null
  const sourceFooter =
    isDiscoveryMotherCard || partnerHttp
      ? ''
      : 'No live retailer link this week — figures still come from your saved audit row.'
  const overlayCtaKind = inferRevenueCtaKind({
    journey: (journeyId ?? 'home') as JourneyId,
    actionType: tipNeedsSwitching
      ? 'switch'
      : String(currentMorphData?.actions?.actionType || 'learn').toLowerCase(),
    needsSwitching: tipNeedsSwitching,
    isPriorityHome: Boolean(isPriorityHome),
  })
  const effectiveHandoffLabel = ctaLabel ?? resolveRevenueCtaLabel(overlayCtaKind, motherMoneyTargetGbp)
  const persistViewState = useCallback((next: OverlayViewState, opts?: { preserveResultContext?: boolean }) => {
    setViewState(next)
    if (next === 'QUESTION' && !opts?.preserveResultContext) {
      setResultCitation(null)
      setLiveClaimUrl(null)
      setDiscoverySnap(null)
      setGeminiRecommendationCopy(null)
      setDiscoveryWinLine(null)
      setBirthedZoneTitle(null)
      setGridContext(null)
      setResearchAttribution(null)
    }
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(sfStorageKey, next)
    } catch {
      // ignore
    }
  }, [sfStorageKey])

  /** Zone expand — mother card is always RESULT; loop questions run on close (pattern-shift). */
  useEffect(() => {
    if (!isZoneMotherChild) return
    if (viewState === 'RESULT') return
    persistViewState('RESULT')
  }, [isZoneMotherChild, viewState, persistViewState])

  useEffect(() => {
    const prev = overlayViewStatePrev.current
    overlayViewStatePrev.current = viewState
    if (prev === 'QUESTION' && viewState === 'RESULT') {
      setLoopZipCollapsing(false)
    }
  }, [viewState])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducePagerMotion(mq.matches)
    const fn = () => setReducePagerMotion(mq.matches)
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', fn)
      return () => mq.removeEventListener('change', fn)
    }
    mq.addListener(fn)
    return () => mq.removeListener(fn)
  }, [])

  useEffect(() => {
    if (viewState !== 'RESULT' || !discoverySnap) {
      setImpactAnswerPulse(false)
      return
    }
    setImpactAnswerPulse(true)
    const t = window.setTimeout(() => setImpactAnswerPulse(false), 720)
    return () => clearTimeout(t)
  }, [viewState, discoverySnap, discoverySnap?.questionId, discoverySnap?.answerValue])

  const finishClose = useCallback(() => {
    triggerHaptic('medium')
    setResultCitation(null)
    setLiveClaimUrl(null)
    setDiscoverySnap(null)
    setGeminiRecommendationCopy(null)
    setDiscoveryWinLine(null)
    setBirthedZoneTitle(null)
    setGridContext(null)
    setViewState('RESULT')
    setMorphedCardsQueue([])
    setActiveSiblingIndex(0)
    setResearchAttribution(null)
    setSoloEmbedQuestionLabel(null)
    setLoopZipCollapsing(false)
    setQuestionCount(0)
    setSpawnHandoffBlank(false)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(sfStorageKey)
      } catch {
        // ignore
      }
    }
    onClose()
  }, [onClose, sfStorageKey])

  const loopJourneyKey = focusCategoryJourneyId

  const requestClose = useCallback(() => {
    triggerHaptic('medium')
    const visitId = String(cardId ?? activeCardId ?? '').trim()
    if (visitId) {
      flushSoloFocusIndifferent(soloFocusEngagementRef.current, {
        card_id: visitId,
        journey_key: loopJourneyKey,
        card_title: displayTitle,
        money_gbp: parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)),
      })
    }
    clearSoloFocusMemory()
    const isRockHabitTip = visitId.startsWith('rock-')
    onPatternShiftClose?.(loopJourneyKey, {
      cardId: visitId || undefined,
      visitedClose:
        isRockHabitTip ||
        cardVisitedLock ||
        (visitId ? shouldCloseMarkPinkOnly(visitId, loopJourneyKey) : false),
    })
    onClose()
  }, [
    loopJourneyKey,
    onPatternShiftClose,
    onClose,
    cardId,
    activeCardId,
    cardVisitedLock,
    displayTitle,
    displayMoneyValue,
  ])

  const requestOfferFeedbackExit = useCallback(
    (signal: 'like' | 'dislike') => {
      triggerHaptic('medium')
      const visitId = String(cardId ?? activeCardId ?? '').trim()
      clearSoloFocusMemory()
      onPatternShiftClose?.(loopJourneyKey, {
        cardId: visitId || undefined,
        offerFeedback: signal,
        cardTitle: displayTitle,
      })
      onClose()
    },
    [loopJourneyKey, onPatternShiftClose, onClose, cardId, activeCardId, displayTitle]
  )

  const handleTrinityLike = useCallback(() => {
    triggerHaptic('medium')
    const id = String(activeCardId || cardId || '')
    if (!id) return
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'like')
    bumpCategoryIntent(loopJourneyKey, 'like')
    const likeFn = onLike ?? toggleLike
    likeFn(id, displayTitle, parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)))
    recordOfferSignal({
      card_id: id,
      signal: 'like',
      journey_key: loopJourneyKey,
      card_title: displayTitle,
      money_gbp: parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)),
    })
    requestOfferFeedbackExit('like')
  }, [
    activeCardId,
    cardId,
    onLike,
    toggleLike,
    displayTitle,
    displayMoneyValue,
    loopJourneyKey,
    requestOfferFeedbackExit,
  ])

  const handleTrinityDislike = useCallback(() => {
    triggerHaptic('medium')
    const id = String(activeCardId || cardId || '')
    if (!id) return
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'dislike')
    toggleDislike(
      id,
      displayTitle,
      parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)),
      loopJourneyKey
    )
    requestOfferFeedbackExit('dislike')
  }, [
    activeCardId,
    cardId,
    toggleDislike,
    displayTitle,
    displayMoneyValue,
    loopJourneyKey,
    requestOfferFeedbackExit,
  ])

  const handleTrinityAskZai = useCallback(() => {
    triggerHaptic('medium')
    const id = String(activeCardId || cardId || '')
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'ask')
    if (id) {
      recordOfferSignal({
        card_id: id,
        signal: 'ask',
        journey_key: loopJourneyKey,
        card_title: displayTitle,
      })
    }
    setAskZaiDeepDiveOpen(true)
  }, [activeCardId, cardId, loopJourneyKey, displayTitle])

  const handleTrinityCta = useCallback(() => {
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'cta')
  }, [])

  const discovery =
    discoverySnap != null && journeyId
      ? {
          rec: getDiscoveryRecommendation(journeyId, discoverySnap.questionId, discoverySnap.answerValue),
          sav: ukAverageSavingForDiscoveryAnswer(journeyId, discoverySnap.questionId, discoverySnap.answerValue),
        }
      : null
  const discoveryImpactKg =
    discoverySnap != null && journeyId
      ? Math.round(estimateDiscoveryCarbonKg(journeyId, discoverySnap.questionId, discoverySnap.answerValue))
      : 0
  const treeEquivalent = Math.max(1, Math.round(discoveryImpactKg / 21))

  const overlaySurfaceKind = discoveryRebirthTip
    ? 'tip'
    : resolveZoneSurfaceKind({
        journeyId,
        cardId,
        category,
      })
  const overlaySurfaceVars =
    overlaySurfaceKind === 'journey'
      ? zoneExpandedJourneySurfaceStyleProps()
      : zoneSurfaceStyleProps(overlaySurfaceKind)

  const overlay = (
    <>
      <motion.div key={activeCardId} className="solo-focus-grow-layer" initial={false}>
      <ExpandedCardShell
        className="expanded-solo-focus view-expanded solo-focus-mobile-expand zz-shimmer-focus"
        data-journey={displayJourneyId ?? 'overlay'}
        data-zone-surface={overlaySurfaceKind}
        style={
          {
            ...overlaySurfaceVars,
            transformOrigin: '50% 50%',
          } as React.CSSProperties
        }
        reduceMotion={reducePagerMotion}
        isExiting={false}
      >
      <PulseExpandedSync providerName={handoffAttribution.pulseProviderName} sourceUrl={pulseSourceUrl} />
        <div className="solo-focus-shell-wrap w-full min-w-0">
      <SoloFocusViewportUtilityStrip onClose={requestClose} />
        <motion.div
          className="solo-focus-stack solo-focus-rail flex flex-col justify-start w-full min-w-0"
        >
          {/* Card A: The Mother */}
          {isZoneMotherChild && (
          <>
              <motion.div
                key={`overlay-hero-${activeSiblingIndex}-${String(activeCardId ?? 'base')}`}
                {...soloFocusSlamMotionProps(reducePagerMotion, false)}
                style={{
                  transformOrigin: 'top center',
                  willChange: 'transform',
                }}
                className="solo-focus-shell solo-focus-mother solo-focus-content-stack w-full min-w-0"
              >
                <SoloFocusMotherStack
                  bodyKey={`overlay-hero-body-${activeSiblingIndex}-${String(activeCardId ?? 'base')}`}
                  zoneCategoryLabel={zoneCategoryLabel}
                  categoryIsNew={isUnreadCard(soloFocusCardId)}
                  headline={recommendationTitle}
                  showComputing={showMotherComputing}
                  prose={trueTipSectionsEl}
                  headlineMotion={
                    reducePagerMotion
                      ? undefined
                      : {
                          initial: SHIMMER_FOCUS.initial,
                          animate: SHIMMER_FOCUS.animate,
                          transition: SHIMMER_FOCUS.transition,
                        }
                  }
                  metrics={
                    <>
                      <MotherCardRenderer
                        categoryLabel=""
                        headline={null}
                        narrative={null}
                        sourceFooter={sourceFooter}
                        verifiedSourceCitation={null}
                        moneyGbp={animatedMoneyGbp}
                        carbonKg={animatedCarbonKg}
                        impactPulse={impactAnswerPulse}
                        ctaUrl={soloHandoff.ctaUrl}
                        ctaJourneyId={journeyId}
                        ctaLabel={soloHandoff.ctaIsZai ? 'ASK ZAI' : effectiveHandoffLabel}
                        offerProviderName={soloHandoff.ctaUrl ? handoffAttribution.offerProviderName : null}
                        isLiked={isLiked}
                        isDisliked={(state.dislikedCards ?? []).includes(
                          String(activeCardId || cardId || '')
                        )}
                        onLike={handleTrinityLike}
                        onAskZai={handleTrinityAskZai}
                        onDislike={handleTrinityDislike}
                        onCtaClick={handleTrinityCta}
                      />
                      {(onNavigateJourney || onNavigateSoloFocus) && journeyId ? (
                        <SoloFocusJourneyNav
                          journeyId={focusCategoryJourneyId}
                          currentCardId={soloFocusCardId}
                          navRing={soloFocusNavRingWithMorph}
                          onNavigateEntry={handleNavigateSoloFocusEntry}
                          onNavigate={onNavigateJourney ?? (() => {})}
                          availableJourneyIds={soloFocusJourneyRing}
                          isUnreadCard={isUnreadCard}
                          className="solo-focus-journey-nav--inset"
                        />
                      ) : null}
                    </>
                  }
                />
              </motion.div>
          </>
          )}

        </motion.div>
        </div>
        </ExpandedCardShell>

      </motion.div>
      <AskZaiDeepDiveSheet
        open={askZaiDeepDiveOpen}
        onClose={() => setAskZaiDeepDiveOpen(false)}
        headline={String(recommendationTitle)}
        category={zoneCategoryLabel}
        journeyKey={loopJourneyKey}
        personalSpend={String(displayMoneyValue).replace(/^£\s*/, '').trim() || '0'}
        regionalAvg={String(displayCarbonValue).replace(/\s*(kg|t)\s*CO₂$/i, '').trim() || '0'}
        scrapedSource={sourceLabel || sourceUrl || ''}
        postcode={profilePostcode ?? state.profile?.postcode}
        localityName={state.locationState?.locationName ?? undefined}
      />
      {!isZoneMotherChild && (
      <motion.div className="fixed right-5 top-5 z-50">
        <motion.button
          type="button"
          aria-label="Close"
          className="circle-btn flex items-center justify-center"
          onClick={requestClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={INDUSTRIAL_OPACITY_SNAP}
          style={{
            width: 40,
            height: 40,
            backgroundColor: 'var(--color-purple)',
            color: 'var(--color-yellow)',
          }}
        >
          <BackArrowDownLeft size={20} />
        </motion.button>
      </motion.div>
      )}
    </>
  )

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(overlay, document.body)
  }
  return null
}
