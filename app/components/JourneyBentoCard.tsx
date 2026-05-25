'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { motion } from 'framer-motion'
import { type JourneyId, getOptionFullLabel } from '@/lib/journeys'
import {
  resolveZoneSurfaceKind,
  zoneSurfaceStyleProps,
  type ZoneSurfaceKind,
} from '@/lib/journeyColors'
import {
  formatMoneyImpact,
  formatCarbonImpact,
  formatZoneCardMoney,
  parseMoneyGbpFromDisplay,
  parseCarbonKgFromDisplay,
} from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { Logo } from '@/app/components/Logo'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { PulseExpandedSync } from '@/app/components/PulseExpandedSync'
import { PulseDiagnosticFab } from '@/app/components/debug/PulseWidget'
import { ExpandedCardShell } from '@/app/components/ExpandedCard'
import { MotherCardRenderer } from '@/app/components/MotherCardRenderer'
import { AskZaiDeepDiveSheet } from '@/app/components/AskZaiDeepDiveSheet'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import { mergeJourneyAnswerMaps, getSoloFocusNextQuestion } from '@/lib/zone/questionHandler'
import { submitSoloFocusJourneyAnswer } from '@/lib/zone/submitSoloFocusJourneyAnswer'
import {
  ZONE_CARD_COMPUTING_ICON_PX,
} from '@/app/components/ui/ZoneCategoryIcon'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import { ZoneAiSparkIcon } from '@/app/components/ui/ZoneAiSparkIcon'
import { pickPrimaryHttpUrl } from '@/lib/soloFocusDiagnosticMeta'
import { resolveSuppliedByDisplayName } from '@/lib/soloFocusSuppliedBy'
import {
  INDUSTRIAL_OPACITY_SNAP,
  SOLO_FOCUS_CONTENT_SNAP_DELAY_SEC,
  SOLO_FOCUS_CONTENT_SNAP_INITIAL,
  SOLO_FOCUS_CONTENT_SNAP_ANIMATE,
  STACCATO_DROP_PX,
  STACCATO_DURATION_SEC,
  STACCATO_STAGGER_SEC,
  STACCATO_TWEEN,
} from '@/lib/animations'
import {
  PRICE_CAP_APRIL_2026,
  PRICE_CAP_MARCH_2026,
  PRICE_CAP_SAVING_APRIL_1,
  APRIL_2026_TRUTH_PENCE,
  APRIL_2026_STANDING_PENCE,
} from '@/lib/brains/constants'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { estimateDiscoveryCarbonKg, ukAverageSavingForDiscoveryAnswer } from '@/lib/brains/calculations'
import {
  headlineFromTitle,
  formatZoneCategoryLabel,
  zoneCardHeadlineFromRaw,
  MAX_EXPANDED_VIEW_HEADLINE_WORDS,
  MAX_ZONE_CARD_HEADLINE_WORDS,
  formatAuditSourceLinkDisplay,
  polishTrueTipParagraphsForHeadline,
  resolveExpandedTrueTipInsight,
  resolveSoloFocusHandoffUrls,
  stripExpandedCardTitleNoise,
  toThreeTrueTipParagraphs,
  wrapResultSupportingAsterisks,
} from '@/lib/soloFocusCopy'
import { useApp } from '@/app/context/AppContext'
import { normalizeCategoryToJourneyKey, trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import { useCountUp } from '@/lib/utils/useCountUp'
import { parseMoneyGbpFromImpactDisplay, parseCarbonKgFromImpactDisplay } from '@/lib/soloFocusImpactParse'
import { useSoloFocusExpandedGestures } from '@/lib/hooks/useSoloFocusExpandedGestures'
import {
  VERIFIED_SOURCE_DATE,
  formatVerifiedCitation,
  inferRevenueCtaKind,
  pickFirstHttpUrl,
  resolveRevenueCtaLabel,
} from '@/lib/zone/verifiedRevenue'
import { prioritizeMorphCardsForContext } from '@/lib/locationMorphPrioritize'
import {
  triggerScrapeSyncForCategory,
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import { openOfferUrlInNewTab } from '@/lib/zone/tier2RecursiveSpawner'
import { openZoneExternalHandoff } from '@/lib/zone/zoneHandoff'
import { clearSoloFocusMemory } from '@/lib/zone/sessionMemory'
import {
  markCardVisited,
  setDeepDiveInProgress,
  shouldSkipInjectionOnCardClose,
} from '@/lib/zone/visitedCards'
import type { PatternShiftCloseHandler } from '@/lib/zone/patternShiftClose'
import { runSoloFocusAuditCompletionClient } from '@/lib/soloFocusAuditCompleteClient'
import {
  SOLO_FOCUS_SNAPSHOT_V,
  soloFocusSnapStorageKeys,
  readSoloFocusSnapshot,
  writeSoloFocusSnapshot,
  clearSoloFocusSnapshot,
  type SoloFocusResultSnapshotV1,
} from '@/lib/soloFocusSessionSnapshot'
import { getNextMorphCard } from '@/lib/zone/getNextMorphCard'
import type { SentinelMotherRecardPayload } from '@/lib/sentinel/recardTypes'

type HomeSentinelRecard = {
  headline: string
  description: string
  moneyGbp: number
  carbonKg: number
  sourceUrl?: string
  verifiedAt?: string
}

function parseSentinelMotherRefresh(raw: unknown): HomeSentinelRecard | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as SentinelMotherRecardPayload
  const headline = typeof p.headline === 'string' ? p.headline.trim() : ''
  if (!headline) return null
  return {
    headline,
    description: typeof p.description === 'string' ? p.description.trim() : '',
    moneyGbp: typeof p.moneyValue === 'number' && Number.isFinite(p.moneyValue) ? p.moneyValue : 0,
    carbonKg: typeof p.carbonValue === 'number' && Number.isFinite(p.carbonValue) ? p.carbonValue : 0,
    sourceUrl: typeof p.source_url === 'string' ? p.source_url : undefined,
    verifiedAt: typeof p.verified_date === 'string' ? p.verified_date : undefined,
  }
}
function readHydrationSnap(snapKey: string, journeyId: JourneyId): SoloFocusResultSnapshotV1 | null {
  if (typeof window === 'undefined') return null
  return readSoloFocusSnapshot(snapKey, journeyId)
}

export interface JourneyBentoCardProps {
  journeyId: JourneyId
  title: string
  carbonValue: string
  moneyValue: string
  carbonKg?: number
  moneyGbp?: number
  isComplete?: boolean
  onRefineQuestions?: (journeyId: JourneyId) => void
  onActionClick?: (journeyId: JourneyId) => void
  crawlerTip?: string
  insightLabel?: string
  insightAlert?: boolean
  fromScraper?: boolean
  showLocalTag?: boolean
  localCarbonG?: number
  hasLocalGrant?: boolean
  localContextBar?: string
  claimOfferUrl?: string
  isPriorityAlert?: boolean
  groovy?: boolean
  kineticGrid?: boolean
  isExpanded?: boolean
  onExpand?: () => void
  onClose?: () => void
  /** Close chevron → dismiss Solo Focus, then full-screen pattern-shift question (Zone shell). */
  onPatternShiftClose?: PatternShiftCloseHandler
  cardId?: string
  onLike?: (id: string, title?: string, moneyGbp?: number) => void
  isLiked?: boolean
  learnUrl?: string
  /** Zone card actions.actionType when morph deck is empty (switch vs learn). */
  learnActionType?: string | null
  /** When true, Trinity shows Ask Zai → in-card deep dive sheet (not navigation). */
  showAskZaiTrinity?: boolean
  /** @deprecated Use {@link showAskZaiTrinity}. Parent callback is ignored; sheet opens locally. */
  onAskZai?: () => void
  onJourneyAnswered?: () => void
  /** Bento Wall: card is in a Tall (1x2) cell and should fill height */
  isTall?: boolean
  /** Zone grid: force card text colour (e.g. yellow on all zone cards) */
  textColorOverride?: string
  /** When opened from a tip: one sentence that describes the offer (replaces generic “answer a few questions”) */
  offerOneLine?: string
  /** Tip/offer URL when opened from a tip (Get opens this) */
  offerUrlOverride?: string
  /** After embedded answer in Solo Focus: scroll Zone to this journey card */
  onSoloEmbedComplete?: (journeyId: JourneyId) => void
  /** Zone citation line (e.g. "source. uk government data") — not insight prose */
  attributionSourceLabel?: string | null
  /** Content Architect verified provider short name */
  architectSuppliedBy?: string | null
  /** Content Architect HOW line (Solo Focus) */
  architectActionLine?: string | null
  /** After POST /api/answers + RESULT (parent-driven side effects; not from Like). */
  onEmbeddedAnswerSuccess?: (info: { cardId?: string; journeyId: JourneyId }) => void
  /** Swipe down at scroll top: open next visible journey on the Zone wall (mobile). */
  onSwipeNextJourney?: (journeyId: JourneyId) => void
  /**
   * After the last question in this journey is answered: close expanded view and let the shell
   * open the next journey in wall order, using `offerLine` as contextual copy on that tile.
   */
  /** v35.0 verified audit citation + revenue handoff */
  verifiedSourceName?: string | null
  verifiedSourceDate?: string | null
  partnerLink?: string | null
  /** v42.8 — Zone VM audit gate; when LIVE, expanded header stays VERIFIED with locality. */
  auditState?: 'LIVE_AUDIT' | 'ESTIMATED_AUDIT' | null
  /** When `category` matches this card’s journey, £ and primary link mirror `research_results` (London DB). */
  verifiedAuditMoneyGbp?: number | null
  verifiedAuditSourceUrl?: string | null
  verifiedAuditCategory?: string | null
  /** Latest `research_results` row per journey category (GET /api/scrape-sync). */
  verifiedArchitectProse?: string | null
  researchCategoryCoverage?: Record<string, ResearchCategoryCoverageRow> | null
  /** Zone: optimistic “generating” after answer until refetch shows insight. */
  insightGenerationPending?: boolean
  /** Zone audit trail — pink tile / yellow type after external handoff. */
  isVisited?: boolean
  /** External link opened — show deep-dive-in-progress strip until return. */
  deepDiveInProgress?: boolean
}

export function JourneyBentoCard({
  journeyId,
  title,
  carbonValue,
  moneyValue,
  onActionClick,
  crawlerTip,
  insightLabel,
  localContextBar,
  claimOfferUrl,
  kineticGrid = false,
  isExpanded = false,
  onExpand,
  onClose,
  onPatternShiftClose,
  cardId,
  onLike,
  isLiked = false,
  showAskZaiTrinity = false,
  onAskZai: _onAskZai,
  onJourneyAnswered,
  showLocalTag,
  localCarbonG,
  groovy = true,
  isTall = false,
  textColorOverride,
  offerOneLine,
  offerUrlOverride,
  learnUrl,
  onSoloEmbedComplete,
  attributionSourceLabel,
  architectSuppliedBy,
  architectActionLine,
  onEmbeddedAnswerSuccess,
  onSwipeNextJourney,
  hasLocalGrant = false,
  isPriorityAlert = false,
  verifiedSourceName,
  verifiedSourceDate,
  partnerLink,
  learnActionType,
  auditState = null,
  verifiedAuditMoneyGbp = null,
  verifiedAuditSourceUrl = null,
  verifiedAuditCategory = null,
  verifiedArchitectProse = null,
  researchCategoryCoverage = null,
  insightGenerationPending = false,
  fromScraper = false,
  isVisited = false,
  deepDiveInProgress = false,
}: JourneyBentoCardProps) {
  const { state } = useApp()
  const profilePostcode =
    (state.profile?.postcode ?? '').replace(/\s+/g, '').trim().toUpperCase() ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('profile_postcode') ?? '').replace(/\s+/g, '').trim().toUpperCase()
      : '') ||
    null
  const effectiveOpen = kineticGrid ? isExpanded : false
  const [isExiting, setIsExiting] = useState(false)
  const { viewKey: soloFocusViewKey, snapKey: soloFocusSnapKey } = soloFocusSnapStorageKeys(cardId, journeyId)
  const [tier2SlotFading, setTier2SlotFading] = useState(false)
  const [resultCitation, setResultCitation] = useState<{
    label: string
    url?: string
    verifiedAt?: string
  } | null>(() => readHydrationSnap(soloFocusSnapKey, journeyId)?.resultCitation ?? null)
  const [liveClaimUrl, setLiveClaimUrl] = useState<string | null>(
    () => readHydrationSnap(soloFocusSnapKey, journeyId)?.liveClaimUrl ?? null
  )
  const [discoverySnap, setDiscoverySnap] = useState<{ questionId: string; answerValue: string } | null>(
    () => readHydrationSnap(soloFocusSnapKey, journeyId)?.discoverySnap ?? null
  )
  /** Gemini / ZeroResearch discovery copy (Roboto body — typographic lock via .zz-body-bold). */
  const [geminiRecommendationCopy, setGeminiRecommendationCopy] = useState<string | null>(
    () => readHydrationSnap(soloFocusSnapKey, journeyId)?.geminiRecommendationCopy ?? null
  )
  /** §18.5 — one-sentence personalized Win (Gemini via /api/answers discovery_win). */
  const [discoveryWinLine, setDiscoveryWinLine] = useState<string | null>(
    () => readHydrationSnap(soloFocusSnapKey, journeyId)?.discoveryWinLine ?? null
  )
  /** Living Discovery Engine — banner when API returns `new_discovery_card`. */
  const [birthedZoneTitle, setBirthedZoneTitle] = useState<string | null>(
    () => readHydrationSnap(soloFocusSnapKey, journeyId)?.birthedZoneTitle ?? null
  )
  const [gridContext, setGridContext] = useState<{
    intensity_g_per_kwh: number | null
    cleaner_vs_2025_pct: number | null
  } | null>(() => readHydrationSnap(soloFocusSnapKey, journeyId)?.gridContext ?? null)
  const surfaceKind: ZoneSurfaceKind = resolveZoneSurfaceKind({
    journeyId,
    cardId,
  })
  const surfaceVars = zoneSurfaceStyleProps(surfaceKind)
  const headline = zoneCardHeadlineFromRaw(
    title || String(journeyId ?? ''),
    formatZoneCategoryLabel(String(journeyId ?? 'home')),
    MAX_ZONE_CARD_HEADLINE_WORDS
  )

  const [morphDeck, setMorphDeck] = useState<any[]>(
    () => (readHydrationSnap(soloFocusSnapKey, journeyId)?.morphDeck as any[]) ?? []
  )
  const [morphDeckCursor, setMorphDeckCursor] = useState(() => {
    const s = readHydrationSnap(soloFocusSnapKey, journeyId)
    if (!s) return 0
    const n = s.morphDeck.length
    return Math.min(Math.max(0, s.morphDeckCursor), n)
  })
  const pagerEnterDir = useRef(1)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const [reducePagerMotion, setReducePagerMotion] = useState(false)
  const [researchAttribution, setResearchAttribution] = useState<{
    headline?: string | null
    supplied_by?: string | null
  } | null>(() => readHydrationSnap(soloFocusSnapKey, journeyId)?.researchAttribution ?? null)
  const [impactAnswerPulse, setImpactAnswerPulse] = useState(false)
  const [embedSubmitting, setEmbedSubmitting] = useState(false)
  const [askZaiDeepDiveOpen, setAskZaiDeepDiveOpen] = useState(false)
  const [heroTotalsOverride, setHeroTotalsOverride] = useState<{ money: number; carbon: number } | null>(null)
  const [homeSentinelRecard, setHomeSentinelRecard] = useState<HomeSentinelRecard | null>(null)
  const prevIsExpandedRef = useRef(false)
  const patternShiftAfterExitRef = useRef<{
    cardId?: string
    visitedClose?: boolean
  } | null>(null)
  const currentMorphData =
    morphDeckCursor > 0 && morphDeck[morphDeckCursor - 1] != null
      ? morphDeck[morphDeckCursor - 1]
      : null

  const sentinelMoneyCarbon =
    journeyId === 'home' && homeSentinelRecard && !currentMorphData
      ? { money: `£${homeSentinelRecard.moneyGbp}`, carbon: `${homeSentinelRecard.carbonKg}kg CO₂` }
      : null

  const displayJourneyId = currentMorphData?.journey_key ?? journeyId
  const displayTitle = currentMorphData?.heading ?? currentMorphData?.title ?? title
  const displayMoneyValue = sentinelMoneyCarbon?.money
    ? sentinelMoneyCarbon.money
    : currentMorphData?.impactMoney
      ? `£${currentMorphData.impactMoney}`
      : currentMorphData?.data?.money ?? (heroTotalsOverride ? `£${heroTotalsOverride.money}` : moneyValue)
  const displayCarbonValue = sentinelMoneyCarbon?.carbon
    ? sentinelMoneyCarbon.carbon
    : currentMorphData?.impactCarbon
      ? `${currentMorphData.impactCarbon}kg CO₂`
      : currentMorphData?.data?.carbon ?? (heroTotalsOverride ? `${heroTotalsOverride.carbon}kg CO₂` : carbonValue)
  const activeCardId = currentMorphData?.id ?? cardId

  const moneyTargetGbp = parseMoneyGbpFromImpactDisplay(displayMoneyValue)
  const carbonTargetKg = parseCarbonKgFromImpactDisplay(displayCarbonValue)
  const verifiedAuditMatchesJourney =
    verifiedAuditMoneyGbp != null &&
    Number.isFinite(verifiedAuditMoneyGbp) &&
    (verifiedAuditCategory ?? '').trim().toLowerCase() === journeyId
  const journeyResearchCov = researchCategoryCoverage?.[journeyId]
  const researchSettled = journeyResearchSettled(journeyResearchCov, {
    streamPending: insightGenerationPending,
  })
  const showCardComputing =
    !researchSettled && (insightGenerationPending || researchCategoryCoverage != null)
  /** ✓ True data — Neon coverage `verified` (derived from `verified_saving` / `saving_amount_gbp` on latest row). */
  const dbVerifiedFromResearchTable =
    researchCategoryCoverage != null ? journeyResearchCov?.verified === true : null
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
    discoverySnap != null
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
  const liveDiscoveryUrl = [
    liveClaimUrl,
    offerUrlOverride,
    claimOfferUrl,
    morphLearnResolved,
    resultCitation?.url,
    learnUrl,
    discoveryRecUrl,
  ].find(
    (u) => typeof u === 'string' && u.trim().length > 0 && !isGenericHomepageUrl(u.trim())
  )?.trim()
  const buildZaiAuditUrl = (): string => {
    const journeyKey = String(displayJourneyId || journeyId)
    const context = `reclaim_${journeyKey}`
    const params = new URLSearchParams({
      context,
      journey: journeyKey,
      title: String(displayTitle || title || ''),
      money: String(Math.round(motherMoneyTargetGbp)),
      carbon: String(Math.round(carbonTargetKg)),
      source: String(attributionSourceLabel || ''),
    })
    return `/zai?${params.toString()}`
  }
  const covOfferHttp =
    journeyResearchCov?.latestOfferUrl?.trim().startsWith('http')
      ? journeyResearchCov.latestOfferUrl.trim()
      : ''
  const covSourceHttp =
    journeyResearchCov?.latestSourceUrl?.trim().startsWith('http')
      ? journeyResearchCov.latestSourceUrl.trim()
      : ''
  /** `/zai` only when `research_results` has no row for this category yet; otherwise wait for source / offer URL. */
  const allowZaiFallback =
    researchCategoryCoverage === undefined || researchCategoryCoverage === null
      ? true
      : journeyResearchCov == null
  const soloHandoff = resolveSoloFocusHandoffUrls({
    journeyKey: journeyId,
    coverageOfferUrl: journeyResearchCov?.latestOfferUrl,
    coverageSourceUrl: journeyResearchCov?.latestSourceUrl,
    fallbackOfferUrl: pickPrimaryHttpUrl(liveDiscoveryUrl, partnerHttp),
    fallbackSourceUrl:
      verifiedAuditMatchesJourney && verifiedAuditSourceUrl?.trim().startsWith('http')
        ? verifiedAuditSourceUrl.trim()
        : covSourceHttp,
    buildZaiUrl: () => (allowZaiFallback ? buildZaiAuditUrl() : ''),
  })
  const resolvedOfferUrl = soloHandoff.ctaUrl
  const ctaActionTypeRaw =
    typeof currentMorphData?.actions?.actionType === 'string'
      ? currentMorphData.actions.actionType.toLowerCase()
      : (typeof learnActionType === 'string' ? learnActionType.toLowerCase() : '')
  const revenueKind = inferRevenueCtaKind({
    journey: displayJourneyId as JourneyId,
    actionType: ctaActionTypeRaw || 'learn',
    needsSwitching: ctaActionTypeRaw === 'switch',
    isPriorityHome: Boolean(isPriorityAlert && ctaActionTypeRaw !== 'switch'),
  })
  const journeyCtaLabel = resolveRevenueCtaLabel(revenueKind, motherMoneyTargetGbp)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducePagerMotion(mq.matches)
    const fn = () => setReducePagerMotion(mq.matches)
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', fn)
      return () => mq.removeEventListener('change', fn)
    }
    // Safari fallback
    mq.addListener(fn)
    return () => mq.removeListener(fn)
  }, [])

  const wasExpandedRef = useRef(false)

  const mergedJourneyAnswers = useMemo(() => {
    let local: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`journey_${journeyId}_answers`)
        local = raw ? (JSON.parse(raw) as Record<string, string>) : {}
      } catch {
        local = {}
      }
    }
    return mergeJourneyAnswerMaps(journeyId, local, state.journeyAnswers?.[journeyId] ?? null)
  }, [journeyId, state.journeyAnswers, effectiveOpen, discoverySnap])

  const embedQuestion = useMemo(() => {
    if (!effectiveOpen || isVisited || discoverySnap) return null
    return getSoloFocusNextQuestion(journeyId, mergedJourneyAnswers)
  }, [effectiveOpen, isVisited, discoverySnap, journeyId, mergedJourneyAnswers])

  const showEmbedQuestion = Boolean(embedQuestion)

  useEffect(() => {
    if (isExpanded && !prevIsExpandedRef.current) {
      const core = cardId ?? journeyId
      const lk = `zz_sf_lane_${core}`
      const qk = `zz_sf_q_${core}`
      const pendingQ = getSoloFocusNextQuestion(journeyId, mergedJourneyAnswers)
      const snap = readHydrationSnap(soloFocusSnapKey, journeyId)
      const viewMode = discoverySnap || !pendingQ || isVisited ? 'RESULT' : 'QUESTION'
      try {
        sessionStorage.removeItem(lk)
        sessionStorage.removeItem(qk)
        sessionStorage.setItem(soloFocusViewKey, viewMode)
      } catch {
        /* ignore */
      }
      setHomeSentinelRecard(null)
      if (!snap || !Array.isArray(snap.morphDeck) || snap.morphDeck.length === 0) {
        const seeded = getNextMorphCard(journeyId, {
          postcode: profilePostcode,
          homeType: state.profile?.homeType ?? null,
          transport: state.profile?.transport ?? null,
          fuelType: state.journeyAnswers?.travel?.fuel_type ?? null,
        })
        setMorphDeck([seeded])
        setMorphDeckCursor(1)
      }
    }
    prevIsExpandedRef.current = isExpanded
    if (isExpanded) {
      wasExpandedRef.current = true
      return
    }
    /* Initial mount is collapsed — do not wipe a hydrated morph deck from session (full reload). */
    if (!wasExpandedRef.current) return
    wasExpandedRef.current = false
    setHomeSentinelRecard(null)
    setMorphDeck([])
    setMorphDeckCursor(0)
    setResearchAttribution(null)
  }, [
    isExpanded,
    journeyId,
    cardId,
    soloFocusSnapKey,
    soloFocusViewKey,
    profilePostcode,
    state.profile?.homeType,
    state.profile?.transport,
    state.journeyAnswers?.travel?.fuel_type,
    mergedJourneyAnswers,
    discoverySnap,
    isVisited,
  ])

  const triggerHaptic = useCallback((pattern: 'light' | 'medium' | 'heavy') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (pattern === 'heavy') navigator.vibrate(25)
      else if (pattern === 'medium') navigator.vibrate(15)
      else navigator.vibrate(5)
    }
  }, [])

  const handleEmbedAnswer = useCallback(
    async (answerValue: string) => {
      if (!embedQuestion || embedSubmitting || isVisited) return
      const questionId = embedQuestion.id
      const answer = String(answerValue ?? '').trim()
      if (!answer) return
      triggerHaptic('medium')
      setEmbedSubmitting(true)
      try {
        const result = await submitSoloFocusJourneyAnswer({
          journeyId,
          questionId,
          answerValue: answer,
          postcode: profilePostcode,
          profileData: state.profile
            ? {
                postcode: state.profile.postcode ?? profilePostcode,
                home_type: state.profile.homeType ?? null,
                home_power: state.profile.homePower ?? null,
                transport_baseline: state.profile.transport ?? null,
              }
            : null,
          journeyAnswers: state.journeyAnswers,
          cardId: cardId ?? null,
        })
        flushSync(() => {
          setDiscoverySnap(result.discoverySnap)
          if (result.discoveryWinLine) setDiscoveryWinLine(result.discoveryWinLine)
          if (result.researchAttribution) setResearchAttribution(result.researchAttribution)
          if (result.birthedZoneTitle) setBirthedZoneTitle(result.birthedZoneTitle)
          if (result.gridContext) setGridContext(result.gridContext)
          const sentinel = parseSentinelMotherRefresh(result.homeSentinelRecard)
          if (sentinel) setHomeSentinelRecard(sentinel)
          if (result.morphCards.length > 0) {
            const prioritized = prioritizeMorphCardsForContext(
              [...morphDeck, ...result.morphCards],
              {
                postcode: profilePostcode,
                profile: { transport: state.profile?.transport ?? null },
                journeyAnswers: state.journeyAnswers,
              }
            )
            setMorphDeck(prioritized)
            setMorphDeckCursor(prioritized.length)
          }
          try {
            sessionStorage.setItem(soloFocusViewKey, 'RESULT')
          } catch {
            /* ignore */
          }
        })
        onJourneyAnswered?.()
        onEmbeddedAnswerSuccess?.({ cardId, journeyId })
        onSoloEmbedComplete?.(journeyId)
      } finally {
        setEmbedSubmitting(false)
      }
    },
    [
      embedQuestion,
      embedSubmitting,
      isVisited,
      journeyId,
      profilePostcode,
      state.profile,
      state.journeyAnswers,
      cardId,
      morphDeck,
      soloFocusViewKey,
      onJourneyAnswered,
      onEmbeddedAnswerSuccess,
      onSoloEmbedComplete,
      triggerHaptic,
    ]
  )

  const beginCloseWithPatternShift = useCallback(() => {
    triggerHaptic('medium')
    clearSoloFocusMemory()
    setDeepDiveInProgress(null)
    const visitId = String(activeCardId || cardId || '').trim()
    if (visitId) markCardVisited(visitId)
    patternShiftAfterExitRef.current = {
      cardId: visitId || undefined,
      visitedClose: visitId ? shouldSkipInjectionOnCardClose(visitId, journeyId) : false,
    }
    setIsExiting((prev) => (prev ? prev : true))
  }, [journeyId, triggerHaptic, activeCardId, cardId])

  const handleCloseStart = useCallback(() => {
    beginCloseWithPatternShift()
  }, [beginCloseWithPatternShift])

  const handleTrinityLike = useCallback(() => {
    if (!onLike || !(activeCardId || cardId)) return
    triggerHaptic('medium')
    onLike(
      String(activeCardId || cardId),
      displayTitle,
      parseMoneyGbpFromImpactDisplay(String(displayMoneyValue))
    )
  }, [onLike, activeCardId, cardId, displayTitle, displayMoneyValue, triggerHaptic])

  const handleTrinityAskZai = useCallback(() => {
    triggerHaptic('medium')
    setAskZaiDeepDiveOpen(true)
  }, [triggerHaptic])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (effectiveOpen || isExiting)) handleCloseStart()
    }
    if (effectiveOpen || isExiting) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [effectiveOpen, isExiting, handleCloseStart])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (morphDeck.length === 0) return
    const snap: SoloFocusResultSnapshotV1 = {
      v: SOLO_FOCUS_SNAPSHOT_V,
      journeyId,
      resultCitation,
      liveClaimUrl,
      discoverySnap,
      geminiRecommendationCopy,
      discoveryWinLine,
      birthedZoneTitle,
      gridContext,
      researchAttribution,
      morphDeck,
      morphDeckCursor,
    }
    writeSoloFocusSnapshot(soloFocusSnapKey, snap)
  }, [
    journeyId,
    soloFocusSnapKey,
    resultCitation,
    liveClaimUrl,
    discoverySnap,
    geminiRecommendationCopy,
    discoveryWinLine,
    birthedZoneTitle,
    gridContext,
    researchAttribution,
    morphDeck,
    morphDeckCursor,
    morphDeck.length,
  ])

  useEffect(() => {
    if (!effectiveOpen || !discoverySnap) {
      setImpactAnswerPulse(false)
      return
    }
    setImpactAnswerPulse(true)
    const t = window.setTimeout(() => setImpactAnswerPulse(false), 720)
    return () => clearTimeout(t)
  }, [effectiveOpen, discoverySnap, discoverySnap?.questionId, discoverySnap?.answerValue])

  const morphDeckLenRef = useRef(0)
  useEffect(() => {
    morphDeckLenRef.current = morphDeck.length
  }, [morphDeck.length])

  /* Re-expand same session: restore result + morph from snapshot (collapse clears morph + attribution only). */
  useEffect(() => {
    if (!effectiveOpen) return
    const s = readSoloFocusSnapshot(soloFocusSnapKey, journeyId)
    if (!s) return
    if (morphDeck.length === 0 && s.morphDeck.length > 0) {
      setMorphDeck(s.morphDeck as any[])
      setMorphDeckCursor(Math.min(Math.max(0, s.morphDeckCursor), s.morphDeck.length))
    }
    if (!researchAttribution && s.researchAttribution) {
      setResearchAttribution(s.researchAttribution)
    }
    if (!resultCitation && s.resultCitation) {
      setResultCitation(s.resultCitation)
    }
    if (!liveClaimUrl && s.liveClaimUrl) {
      setLiveClaimUrl(s.liveClaimUrl)
    }
    if (!discoverySnap && s.discoverySnap) {
      setDiscoverySnap(s.discoverySnap)
    }
    if (!geminiRecommendationCopy && s.geminiRecommendationCopy) {
      setGeminiRecommendationCopy(s.geminiRecommendationCopy)
    }
    if (!discoveryWinLine && s.discoveryWinLine) {
      setDiscoveryWinLine(s.discoveryWinLine)
    }
    if (!birthedZoneTitle && s.birthedZoneTitle) {
      setBirthedZoneTitle(s.birthedZoneTitle)
    }
    if (!gridContext && s.gridContext) {
      setGridContext(s.gridContext)
    }
  }, [
    effectiveOpen,
    morphDeck.length,
    researchAttribution,
    resultCitation,
    liveClaimUrl,
    discoverySnap,
    geminiRecommendationCopy,
    discoveryWinLine,
    birthedZoneTitle,
    gridContext,
    soloFocusSnapKey,
    journeyId,
  ])
  useEffect(() => {
    setMorphDeckCursor((c) => Math.max(0, Math.min(c, morphDeck.length)))
  }, [morphDeck.length])

  const goPagerNewer = useCallback(() => {
    setMorphDeckCursor((c) => {
      if (c >= morphDeckLenRef.current) return c
      pagerEnterDir.current = 1
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
      return c + 1
    })
  }, [])

  const goPagerOlder = useCallback(() => {
    setMorphDeckCursor((c) => {
      if (c <= 0) return c
      pagerEnterDir.current = -1
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
      return c - 1
    })
  }, [])

  const expandedGestures = useSoloFocusExpandedGestures({
    scrollRef: bodyScrollRef,
    onSwipeToNewer: goPagerNewer,
    onSwipeToOlder: goPagerOlder,
    onSwipeUpDismiss: () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15)
      handleCloseStart()
    },
    onSwipeDownNextJourney: () => onSwipeNextJourney?.(journeyId),
    enabled: kineticGrid && (effectiveOpen || isExiting),
  })

  useEffect(() => {
    if (!kineticGrid || !effectiveOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goPagerNewer()
      if (e.key === 'ArrowLeft') goPagerOlder()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [kineticGrid, effectiveOpen, goPagerNewer, goPagerOlder])

  useEffect(() => {
    if (isExpanded) return
  }, [isExpanded])

  const handleOpenOfferUrl = useCallback(() => {
    triggerHaptic('light')
    const url = pickPrimaryHttpUrl(resolvedOfferUrl)
    const fallback = pickPrimaryHttpUrl(
      journeyResearchCov?.latestOfferUrl ?? journeyResearchCov?.latestSourceUrl ?? ''
    )
    const target = url || fallback
    const handoffId = cardId ?? `journey-${journeyId}`
    if (target && openZoneExternalHandoff({ cardId: handoffId, url: target, title, journeyKey: journeyId })) {
      return
    }
    if (!openOfferUrlInNewTab(target)) {
      openOfferUrlInNewTab(fallback)
    }
  }, [resolvedOfferUrl, journeyResearchCov, triggerHaptic, cardId, journeyId, title])

  // —— EXPANDED (Solo Focus): v1.7 Active Intelligence — strict 00-00 Industrial Layout ——
  if (kineticGrid && (effectiveOpen || isExiting)) {
    /* v1.8.2 — H1 from morph card, else latest research_results.agent_headline, else tile title */
    const effectiveTitleRaw =
      journeyId === 'home' && homeSentinelRecard && !currentMorphData
        ? homeSentinelRecard.headline
        : currentMorphData
          ? String(displayTitle || displayJourneyId).trim() || displayJourneyId
          : researchAttribution?.headline?.trim() ||
            String(displayTitle || title || journeyId).trim() ||
            journeyId
    const recommendationTitle = headlineFromTitle(
      stripExpandedCardTitleNoise(String(effectiveTitleRaw)),
      MAX_EXPANDED_VIEW_HEADLINE_WORDS
    )
    const titleLooksEstimated = /^\s*ESTIMATED AUDIT\b/i.test(String(displayTitle ?? title ?? ''))
    const useEstimated =
      auditState === 'ESTIMATED_AUDIT' || (!auditState && titleLooksEstimated)
    const zoneCategoryLabel = formatZoneCategoryLabel(String(displayJourneyId || journeyId))
    let sourceName = 'our partners'
    if (resolvedOfferUrl) {
      try { sourceName = new URL(resolvedOfferUrl).hostname.replace('www.', '') } catch {}
    }
    const diagnosticUrlJourney = soloHandoff.sourceLinkUrl
    const profileTransport =
      state.profile?.transport ??
      (typeof window !== 'undefined' ? localStorage.getItem('profile_transport') : null)
    const travelFuel = state.journeyAnswers?.travel?.fuel_type ?? null
    const insightDisplay = resolveExpandedTrueTipInsight({
      architectProse: verifiedArchitectProse,
      verifiedAuditMatchesJourney,
      morphParts: [
        journeyId === 'home' && homeSentinelRecard && !currentMorphData ? homeSentinelRecard.description : undefined,
        currentMorphData?.description,
        insightLabel,
        crawlerTip,
        localContextBar,
        offerOneLine,
      ],
      journeyId: String(displayJourneyId || journeyId),
      headline: recommendationTitle,
      moneyGbp: motherMoneyTargetGbp,
      carbonKg: carbonTargetKg,
      transportBaseline: profileTransport,
      travelFuelType: travelFuel,
      userPostcode: profilePostcode ?? undefined,
      sourceDisplayName: verifiedSourceName ?? undefined,
      auditHeaderLocality: state.locationState?.locationName ?? undefined,
    })
    const trueTipParagraphs = polishTrueTipParagraphsForHeadline(
      recommendationTitle,
      toThreeTrueTipParagraphs(insightDisplay)
    )
    const verifiedSourceLinkUrl = soloHandoff.sourceLinkUrl
    const verifiedSourceLinkEl = verifiedSourceLinkUrl ? (
      <a
        href={verifiedSourceLinkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="solo-focus-verified-source-link"
        onClick={(e) => e.stopPropagation()}
      >
        {formatAuditSourceLinkDisplay(verifiedSourceLinkUrl)}
      </a>
    ) : null
    const trueTipSectionsEl =
      trueTipParagraphs.some((p) => p.trim().length > 0) || verifiedSourceLinkEl ? (
        <div className="solo-focus-true-tip-sections flex flex-col gap-0 w-full min-w-0 mt-1">
          {trueTipParagraphs.map((para, i) =>
            para?.trim() ? (
              <p
                key={`architect-p-${i}`}
                className="solo-focus-architect-prose solo-focus-copy-width solo-focus-content-text text-left m-0"
                style={{ color: 'var(--journey-text)' }}
              >
                {para}
              </p>
            ) : null
          )}
          {verifiedSourceLinkEl}
        </div>
      ) : null

    const diagnosticProviderJourney = resolveSuppliedByDisplayName({
      researchSuppliedBy: researchAttribution?.supplied_by,
      architectSuppliedBy,
      sourceLabel: attributionSourceLabel ?? undefined,
      sourceName,
      liveScrapeSourceUrl:
        verifiedAuditMatchesJourney && verifiedAuditSourceUrl?.trim().startsWith('http')
          ? verifiedAuditSourceUrl.trim()
          : pickPrimaryHttpUrl(resolvedOfferUrl) ?? undefined,
    })
    const sourceFooter = partnerHttp
      ? ''
      : 'Fresh Audit: live partner offer unavailable, running verified fallback.'
    const verifiedCitation = formatVerifiedCitation(
      (verifiedSourceName ?? diagnosticProviderJourney).trim(),
      (verifiedSourceDate ?? VERIFIED_SOURCE_DATE).trim()
    )

    const discovery =
      discoverySnap != null
        ? {
            rec: getDiscoveryRecommendation(journeyId, discoverySnap.questionId, discoverySnap.answerValue),
            sav: ukAverageSavingForDiscoveryAnswer(journeyId, discoverySnap.questionId, discoverySnap.answerValue),
          }
        : null

    const discoveryImpactKg =
      discoverySnap != null
        ? Math.round(
            estimateDiscoveryCarbonKg(journeyId, discoverySnap.questionId, discoverySnap.answerValue)
          )
        : 0
    const treeEquivalent = Math.max(1, Math.round(discoveryImpactKg / 21))
    const motherShimmerKey = `${morphDeckCursor}-${currentMorphData?.id ?? 'base'}-${homeSentinelRecard?.headline ?? ''}-${homeSentinelRecard?.moneyGbp ?? 0}`
    const controlsAfterQuestionSec = STACCATO_DURATION_SEC + STACCATO_STAGGER_SEC
    const embedQuestionLabel = embedQuestion?.label?.trim() ?? ''

    const handleCloseComplete = () => {
      onClose?.()
      setIsExiting(false)
      setMorphDeck([])
      setMorphDeckCursor(0)
      setResearchAttribution(null)
      const meta = patternShiftAfterExitRef.current
      patternShiftAfterExitRef.current = null
      if (meta) onPatternShiftClose?.(journeyId, meta)
    }

    const expandedOverlay =
        kineticGrid && (effectiveOpen || isExiting) ? (
          <>
            <motion.div
              key={`sf-grow-${journeyId}-${cardId ?? 'card'}`}
              ref={bodyScrollRef}
              className="solo-focus-grow-layer"
              initial={false}
            >
            <ExpandedCardShell
            data-journey={displayJourneyId}
            data-zone-surface={surfaceKind}
            className="expanded-solo-focus view-expanded solo-focus-mobile-expand"
            style={
              {
                ...surfaceVars,
                transformOrigin: '50% 50%',
              } as React.CSSProperties
            }
            reduceMotion={reducePagerMotion}
            isExiting={isExiting}
            onAnimationComplete={() => {
              if (isExiting) {
                handleCloseComplete()
              }
            }}
            onTouchStart={expandedGestures.onTouchStart}
            onTouchEnd={expandedGestures.onTouchEnd}
          >
        <PulseExpandedSync
          providerName={diagnosticProviderJourney}
          sourceUrl={diagnosticUrlJourney}
        />

        <motion.div className="solo-focus-rail w-full min-w-0">
        <motion.div
          className="solo-focus-stack flex flex-col items-stretch justify-start w-full min-w-0"
          initial={reducePagerMotion ? false : SOLO_FOCUS_CONTENT_SNAP_INITIAL}
          animate={SOLO_FOCUS_CONTENT_SNAP_ANIMATE}
          transition={{
            ...INDUSTRIAL_OPACITY_SNAP,
            delay: reducePagerMotion ? 0 : SOLO_FOCUS_CONTENT_SNAP_DELAY_SEC,
          }}
        >
            <motion.div
              key={`sf-hero-${morphDeckCursor}-${displayJourneyId}-${String(activeCardId ?? 'base')}`}
              className={`solo-focus-shell solo-focus-mother solo-focus-content-stack w-full min-w-0${currentMorphData?.high_impact ? ' zz-high-impact-rebirth' : ''}`}
            >
            <div className="solo-focus-expanded-toolbar solo-focus-mother-columns w-full min-w-0">
              <div className="solo-focus-mother-copy flex-1 min-w-0 flex flex-col items-stretch w-full min-w-0">
                <div key={motherShimmerKey} className="flex flex-col gap-2 w-full min-w-0">
            {showCardComputing && !showEmbedQuestion ? (
              <p
                className="zz-label m-0 opacity-80"
                style={{ color: 'var(--journey-text)', letterSpacing: '0.04em' }}
              >
                Computing…
              </p>
            ) : null}
            <span
              className="card-top-label solo-focus-zone-category m-0 text-left w-full block"
              style={{ color: 'var(--journey-text)' }}
            >
              {zoneCategoryLabel}
            </span>
            {showEmbedQuestion && embedQuestion ? (
              <motion.div
                className="profile-step-slam w-full flex flex-col items-stretch"
                style={{ gap: 40, maxWidth: 520, marginInline: 'auto' }}
                initial={reducePagerMotion ? false : { opacity: 0, y: STACCATO_DROP_PX }}
                animate={{ opacity: 1, y: 0 }}
                transition={reducePagerMotion ? { duration: 0.12 } : STACCATO_TWEEN}
              >
                <motion.div
                  className="text-marvin profile-question-headline text-left"
                  style={{
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.06em',
                    maxWidth: 'min(92vw, 28rem)',
                  }}
                >
                  <span style={{ whiteSpace: 'pre-line', display: 'block' }}>{embedQuestionLabel}</span>
                </motion.div>
                <div className="profile-step-controls profile-step-controls--options">
                  {(embedQuestion.options ?? []).map((opt, optionIndex) => {
                    const optValue = String(opt).trim()
                    const display = getOptionFullLabel(optValue)
                    const optAria = display.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
                    return (
                      <ProfileAnswerBtn
                        key={optValue}
                        className=""
                        reduceMotion={reducePagerMotion}
                        optionIndex={optionIndex}
                        delaySeconds={controlsAfterQuestionSec + optionIndex * STACCATO_STAGGER_SEC}
                        disabled={embedSubmitting}
                        onClick={() => void handleEmbedAnswer(optValue)}
                        aria-label={optAria}
                      >
                        <span className="profile-answer-btn__text zz-h4">{display}</span>
                      </ProfileAnswerBtn>
                    )
                  })}
                </div>
              </motion.div>
            ) : (
              <>
                <motion.h1
                  className="solo-focus-architect-headline solo-focus-content-text text-marvin zz-h3 text-left"
                  style={{
                    color: 'var(--journey-text)',
                    margin: 0,
                    padding: 0,
                  }}
                >
                  {recommendationTitle}
                </motion.h1>
                {trueTipSectionsEl}

                <MotherCardRenderer
                  categoryLabel=""
                  headline={null}
                  narrative={null}
                  sourceFooter={sourceFooter}
                  verifiedSourceCitation={verifiedCitation}
                  actionLine={architectActionLine}
                  moneyGbp={animatedMoneyGbp}
                  carbonKg={animatedCarbonKg}
                  verifiedDataBadge={Boolean(dbVerifiedFromResearchTable)}
                  impactPulse={impactAnswerPulse}
                  ctaUrl={soloHandoff.ctaUrl}
                  ctaJourneyId={displayJourneyId as string}
                  ctaLabel={soloHandoff.ctaIsZai ? 'ASK ZAI' : journeyCtaLabel}
                  ctaSurface={currentMorphData?.high_impact ? 'yellow' : 'pink'}
                  isLiked={isLiked}
                  onLike={onLike ? handleTrinityLike : undefined}
                  onAskZai={showAskZaiTrinity || _onAskZai ? handleTrinityAskZai : undefined}
                />
              </>
            )}
                </div>
              </div>
              <div
                className="solo-focus-utility-strip flex flex-col items-end"
                style={{ gap: 20 }}
                aria-label="Solo focus actions"
              >
                  <motion.button
                  type="button"
                  aria-label="Close"
                  className="solo-focus-close-circle"
                  onClick={() => beginCloseWithPatternShift()}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={INDUSTRIAL_OPACITY_SNAP}
                  style={{ transformOrigin: 'top right' }}
                >
                  <BackArrowDownLeft size={24} />
                </motion.button>
                <PulseDiagnosticFab />
              </div>
            </div>
            </motion.div>
        </motion.div>
        </motion.div>
      </ExpandedCardShell>
            </motion.div>
      <AskZaiDeepDiveSheet
        open={askZaiDeepDiveOpen}
        onClose={() => setAskZaiDeepDiveOpen(false)}
        headline={String(recommendationTitle)}
        category={zoneCategoryLabel}
        journeyKey={journeyId}
        personalSpend={moneyValue.replace(/^£\s*/, '').trim() || '0'}
        regionalAvg={carbonValue.replace(/\s*(kg|t)\s*CO₂$/i, '').trim() || '0'}
        scrapedSource={insightLabel || crawlerTip || localContextBar || ''}
        postcode={state.profile?.postcode}
        suggestedQuestions={[
          'Why this shift saves money',
          'What is the carbon trade-off',
          'What is the next concrete step',
        ]}
      />
          </>
      ) : null

    if (typeof document !== 'undefined' && document.body) {
      return createPortal(expandedOverlay, document.body)
    }
    return null
  }

  // —— COLLAPSED: Zero Zero Card Spec — Label (top-left), Arrow 3× (top-right, hover hint), Headline, Data Stack ——

  return (
      <motion.div
        data-journey={journeyId}
        data-zone-surface={surfaceKind}
        onClick={() => {
          triggerHaptic('medium')
          onExpand?.()
        }}
        className={[
          'bento-card-groovy cursor-pointer w-full h-full flex flex-col min-h-0',
          isTall ? 'span-tall-block' : '',
          isVisited ? 'zone-card--visited' : '',
          deepDiveInProgress ? 'zone-card--deep-dive-pending' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          ...(isVisited
            ? {
                '--journey-bg': 'var(--color-pink)',
                '--journey-text': 'var(--color-yellow)',
                '--color-ink': 'var(--color-yellow)',
              }
            : surfaceVars),
          height: '100%',
          ...(isTall && { minHeight: '100%' }),
        }}
        animate={{ opacity: tier2SlotFading ? 0.35 : 1 }}
        transition={INDUSTRIAL_OPACITY_SNAP}
      >
      <div className="flex items-center justify-between w-full shrink-0 pointer-events-none">
        <ZoneBentoCardHeader journeyId={journeyId} textColor="currentColor" />
      </div>
      <motion.h3
        className="card-headline m-0 min-w-0"
        lang="en"
      >
        {headline}
      </motion.h3>
      {/* Only one savings display allowed — shown in the bottom data grid */}
      <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0 mt-auto shrink-0">
        <div className="data-stack data-stack--tight">
          <span className="data-label text-data">SAVE</span>
          <span className="data-value text-data data-stamp-metric">
            <StampedMoneyGbp gbp={parseMoneyGbpFromDisplay(moneyValue || '0')} />
          </span>
        </div>
        <div className="data-stack data-stack--tight data-stack--secondary">
          <span className="data-label">CARBON</span>
          <span className="data-value data-stamp-metric">
            <StampedCarbonKg kg={parseCarbonKgFromDisplay(carbonValue || '0')} />
          </span>
        </div>
      </div>
      {showCardComputing ? (
        <div className="mt-2 shrink-0 flex items-center zone-card-computing-foot" aria-label="Computing">
          <ZoneAiSparkIcon
            size={ZONE_CARD_COMPUTING_ICON_PX}
            className="zone-ai-spark-icon"
            style={{ color: 'currentColor' }}
          />
        </div>
      ) : null}
    </motion.div>
  )
}

