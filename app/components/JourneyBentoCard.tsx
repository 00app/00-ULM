'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { type JourneyId } from '@/lib/journeys'
import { getJourneyCardTextHex } from '@/lib/journeyColors'
import { buildSoloFocusAskZaiQuestion, setAskZaiContext } from '@/lib/expandStorage'
import {
  formatMoneyImpact,
  formatCarbonImpact,
  formatZoneCardMoney,
  parseMoneyGbpFromDisplay,
  parseCarbonKgFromDisplay,
} from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { PulseExpandedSync } from '@/app/components/PulseExpandedSync'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import { EmbeddedJourneyQuestion } from '@/app/components/EmbeddedJourneyQuestion'
import { pickPrimaryHttpUrl, fallbackDiagnosticUrl } from '@/lib/soloFocusDiagnosticMeta'
import { resolveSuppliedByDisplayName } from '@/lib/soloFocusSuppliedBy'
import {
  SPRING_BLOOM,
  SPRING_TAP,
  FADE_VARIANTS,
  WORD_APPEAR,
  soloFocusSlamMotionProps,
  SLAM_SPRING,
  DAMPED_SLAM_INITIAL,
  DAMPED_SLAM_ANIMATE,
} from '@/lib/animations'
import {
  PRICE_CAP_APRIL_2026,
  PRICE_CAP_MARCH_2026,
  PRICE_CAP_SAVING_APRIL_1,
} from '@/lib/brains/constants'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { estimateDiscoveryCarbonKg, ukAverageSavingForDiscoveryAnswer } from '@/lib/brains/calculations'
import {
  headlineFromTitle,
  resolveSoloFocusInsightDisplay,
  wrapResultSupportingAsterisks,
} from '@/lib/soloFocusCopy'
import { useApp } from '@/app/context/AppContext'
import { isScottishPostcodeArea, regionalHeatPumpGrantGbp } from '@/lib/zone/regionalGrants'
import { normalizeCategoryToJourneyKey, trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import { useCountUp } from '@/lib/utils/useCountUp'
import { parseMoneyGbpFromImpactDisplay, parseCarbonKgFromImpactDisplay } from '@/lib/soloFocusImpactParse'
import { useSoloFocusExpandedGestures } from '@/lib/hooks/useSoloFocusExpandedGestures'
import { locationInPhrase } from '@/lib/locationIdentity'
import { prioritizeMorphCardsForContext } from '@/lib/locationMorphPrioritize'
import {
  SOLO_FOCUS_SNAPSHOT_V,
  soloFocusSnapStorageKeys,
  readSoloFocusSnapshot,
  writeSoloFocusSnapshot,
  clearSoloFocusSnapshot,
  type SoloFocusResultSnapshotV1,
} from '@/lib/soloFocusSessionSnapshot'
import { pickOfferLineFromAnswerMorph } from '@/lib/soloFocusAnswerHandoff'
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
  const o = raw as Record<string, unknown>
  if (typeof o.headline !== 'string' || typeof o.description !== 'string') return null
  if (typeof o.moneyValue !== 'number' || typeof o.carbonValue !== 'number') return null
  return {
    headline: o.headline,
    description: o.description,
    moneyGbp: o.moneyValue,
    carbonKg: o.carbonValue,
    sourceUrl: typeof o.source_url === 'string' ? o.source_url : undefined,
    verifiedAt: typeof o.verified_date === 'string' ? o.verified_date : undefined,
  }
}

/** Hydrate morph deck + citation after reload even when the bottom rail is still QUESTION (infinite loop). */
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
  cardId?: string
  onLike?: (id: string, title?: string, moneyGbp?: number) => void
  isLiked?: boolean
  learnUrl?: string
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
  onAdvanceToNextJourneyAfterAnswer?: (payload: { fromJourneyId: JourneyId; offerLine: string }) => void
}

/** Card text follows industrial surface lock (journeyColors). */
function useTextColor(journeyId: JourneyId): string {
  return getJourneyCardTextHex(journeyId)
}

/** Bento card / Solo Focus — same northeast “open” stroke as `card-top-arrow` tiles. */
function BentoNortheastOpenArrow({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  )
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
  cardId,
  onLike,
  isLiked = false,
  onAskZai,
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
  onAdvanceToNextJourneyAfterAnswer,
}: JourneyBentoCardProps) {
  const { state } = useApp()
  const profilePostcode = state.profile?.postcode ?? null
  const prefersReducedMotion = useReducedMotion()
  type ExpandedViewState = 'QUESTION' | 'RESULT'
  const effectiveOpen = kineticGrid ? isExpanded : false
  const [isExiting, setIsExiting] = useState(false)
  const { viewKey: soloFocusViewKey, snapKey: soloFocusSnapKey } = soloFocusSnapStorageKeys(cardId, journeyId)
  const [loopZipCollapsing, setLoopZipCollapsing] = useState(false)
  const [viewState, setViewState] = useState<ExpandedViewState>(() => {
    if (typeof window === 'undefined') return 'QUESTION'
    try {
      const raw = sessionStorage.getItem(soloFocusViewKey)
      return raw === 'RESULT' ? 'RESULT' : 'QUESTION'
    } catch {
      return 'QUESTION'
    }
  })
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
  const color = `var(--color-j-${journeyId})`
  const resolvedTextColor = useTextColor(journeyId)
  const textColor = textColorOverride ?? resolvedTextColor
  const headline = headlineFromTitle(title || String(journeyId ?? ''))

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
  const [soloEmbedQuestionLabel, setSoloEmbedQuestionLabel] = useState<string | null>(null)
  const [impactAnswerPulse, setImpactAnswerPulse] = useState(false)
  const [heroTotalsOverride, setHeroTotalsOverride] = useState<{ money: number; carbon: number } | null>(null)
  const [homeSentinelRecard, setHomeSentinelRecard] = useState<HomeSentinelRecard | null>(null)
  const prevIsExpandedRef = useRef(false)
  const soloFocusViewStatePrev = useRef<ExpandedViewState>(viewState)
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
  const animatedMoneyGbp = useCountUp(moneyTargetGbp, { duration: 520 })
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

  const resolvedOfferUrl =
    [
      liveClaimUrl,
      morphLearnResolved,
      resultCitation?.url,
      offerUrlOverride,
      claimOfferUrl,
      learnUrl,
      discoveryRecUrl,
      pickPrimaryHttpUrl(fallbackDiagnosticUrl((displayJourneyId as JourneyId | undefined) ?? journeyId)),
    ].find((u) => typeof u === 'string' && u.trim().length > 0)?.trim() ?? ''

  const physicalSoloHref = pickPrimaryHttpUrl(resolvedOfferUrl)

  const recommendationTitle = headlineFromTitle((displayTitle || String(displayJourneyId)).trim() || String(displayJourneyId)).toUpperCase()
  let sourceName = 'our partners'
  if (resolvedOfferUrl) {
    try { sourceName = new URL(resolvedOfferUrl).hostname.replace('www.', '') } catch {}
  }
  const profileTransport =
    state.profile?.transport ??
    (typeof window !== 'undefined' ? localStorage.getItem('profile_transport') : null)
  const travelFuel = state.journeyAnswers?.travel?.fuel_type ?? null
  const insightDisplay = resolveSoloFocusInsightDisplay({
    morphParts: [currentMorphData?.description, insightLabel, crawlerTip, localContextBar, offerOneLine],
    journeyId: String(displayJourneyId || journeyId),
    headline: recommendationTitle,
    moneyGbp: moneyTargetGbp,
    carbonKg: carbonTargetKg,
    transportBaseline: profileTransport,
    travelFuelType: travelFuel,
  })

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
  useEffect(() => {
    if (isExpanded && !prevIsExpandedRef.current) {
      const lk = `zz_sf_lane_${cardId ?? journeyId}`
      try {
        sessionStorage.removeItem(lk)
      } catch {
        /* ignore */
      }
      setHomeSentinelRecard(null)
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
    setLoopZipCollapsing(false)
  }, [isExpanded])

  const handleCloseStart = useCallback(() => {
    /* Do not clear RESULT / discovery here — user must see the archived tip when they reopen this tile (§18.5.4). */
    setSoloEmbedQuestionLabel(null)
    setLoopZipCollapsing(false)
    setIsExiting((prev) => {
      if (prev) return prev
      return true
    })
  }, [])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (effectiveOpen || isExiting)) handleCloseStart()
    }
    if (effectiveOpen || isExiting) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [effectiveOpen, isExiting, handleCloseStart])

  // Persist view state so refreshKey/unlockedCount re-renders don't bounce RESULT -> QUESTION.
  const persistViewState = (next: ExpandedViewState, opts?: { preserveResultContext?: boolean }) => {
    setViewState(next)
    const clearTrap = next === 'QUESTION' && !opts?.preserveResultContext
    if (clearTrap) {
      setResultCitation(null)
      setLiveClaimUrl(null)
      setDiscoverySnap(null)
      setDiscoveryWinLine(null)
      setBirthedZoneTitle(null)
      setGridContext(null)
      setGeminiRecommendationCopy(null)
      setResearchAttribution(null)
    }
    if (typeof window === 'undefined') return
    try {
      if (clearTrap) {
        clearSoloFocusSnapshot(soloFocusSnapKey)
      }
      sessionStorage.setItem(soloFocusViewKey, next)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (viewState !== 'RESULT' && morphDeck.length === 0) return
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
    viewState,
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
    const prev = soloFocusViewStatePrev.current
    soloFocusViewStatePrev.current = viewState
    if (prev === 'QUESTION' && viewState === 'RESULT') {
      setLoopZipCollapsing(false)
    }
  }, [viewState])

  // When the overlay collapses, keep RESULT + trap payload so reopening the same tile shows the archived tip (§18.5.4).
  useEffect(() => {
    if (effectiveOpen) return
    if (typeof window === 'undefined') return
    if (viewState === 'RESULT') return
    try {
      const s = readSoloFocusSnapshot(soloFocusSnapKey, journeyId)
      if (s && Array.isArray(s.morphDeck) && s.morphDeck.length > 0) return
    } catch {
      /* ignore */
    }
    setResultCitation(null)
    setLiveClaimUrl(null)
    setDiscoverySnap(null)
    setGeminiRecommendationCopy(null)
    setDiscoveryWinLine(null)
    setBirthedZoneTitle(null)
    setGridContext(null)
    try {
      sessionStorage.removeItem(soloFocusViewKey)
      clearSoloFocusSnapshot(soloFocusSnapKey)
    } catch {
      // ignore
    }
  }, [effectiveOpen, soloFocusViewKey, soloFocusSnapKey, viewState, journeyId])

  useEffect(() => {
    if (!effectiveOpen || viewState !== 'RESULT' || !discoverySnap) {
      setImpactAnswerPulse(false)
      return
    }
    setImpactAnswerPulse(true)
    const t = window.setTimeout(() => setImpactAnswerPulse(false), 720)
    return () => clearTimeout(t)
  }, [effectiveOpen, viewState, discoverySnap, discoverySnap?.questionId, discoverySnap?.answerValue])

  const morphDeckLenRef = useRef(0)
  useEffect(() => {
    morphDeckLenRef.current = morphDeck.length
  }, [morphDeck.length])

  /* Re-expand same session: restore morph + research from snapshot (collapse clears those only). */
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
  }, [effectiveOpen, morphDeck.length, researchAttribution, soloFocusSnapKey, journeyId])
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

  const handlePagerSelect = useCallback((targetIndex: number) => {
    setMorphDeckCursor((current) => {
      const clamped = Math.max(0, Math.min(targetIndex, morphDeckLenRef.current))
      if (clamped === current) return current
      pagerEnterDir.current = clamped > current ? 1 : -1
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
      return clamped
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

  const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (pattern === 'heavy') navigator.vibrate(25)
      else if (pattern === 'medium') navigator.vibrate(15)
      else navigator.vibrate(5)
    }
  }

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
    const recommendationTitle = headlineFromTitle(effectiveTitleRaw).toUpperCase()
    let sourceName = 'our partners'
    if (resolvedOfferUrl) {
      try { sourceName = new URL(resolvedOfferUrl).hostname.replace('www.', '') } catch {}
    }
    const profileTransport =
      state.profile?.transport ??
      (typeof window !== 'undefined' ? localStorage.getItem('profile_transport') : null)
    const travelFuel = state.journeyAnswers?.travel?.fuel_type ?? null
    const locationPhrase = locationInPhrase(state.locationState?.locationName ?? '')
    const insightDisplay = resolveSoloFocusInsightDisplay({
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
      moneyGbp: moneyTargetGbp,
      carbonKg: carbonTargetKg,
      transportBaseline: profileTransport,
      travelFuelType: travelFuel,
    })

    const diagnosticProviderJourney = resolveSuppliedByDisplayName({
      researchSuppliedBy: researchAttribution?.supplied_by,
      architectSuppliedBy,
      sourceLabel: attributionSourceLabel ?? undefined,
      sourceName,
      liveScrapeSourceUrl: pickPrimaryHttpUrl(resolvedOfferUrl) ?? undefined,
    })
    const diagnosticUrlJourney =
      pickPrimaryHttpUrl(resolvedOfferUrl) ||
      fallbackDiagnosticUrl((displayJourneyId as JourneyId | undefined) ?? journeyId)

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
    const pagerPageCount = 1 + morphDeck.length

    const handleCloseComplete = () => {
      onClose?.()
      setIsExiting(false)
      setMorphDeck([])
      setMorphDeckCursor(0)
      setResearchAttribution(null)
    }

    const surfaceJourneyId = displayJourneyId as JourneyId

    const expandedOverlay = (
        kineticGrid && (effectiveOpen || isExiting) ? (
          <motion.div key={`sf-grow-${journeyId}-${cardId ?? 'card'}`} className="solo-focus-grow-layer" initial={false}>
            <motion.div
            layout
            layoutId={currentMorphData ? undefined : `card-${journeyId}`}
            data-journey={displayJourneyId}
            data-sf-yellow-slab="true"
            className="expanded-solo-focus view-expanded solo-focus-mobile-expand"
            style={
              {
                ['--journey-bg' as string]: '#F0FF00',
                ['--journey-text' as string]: 'var(--color-purple)',
                ['--color-ink' as string]: 'var(--color-purple)',
                ['--journey-accent' as string]: 'var(--color-purple)',
                ['--journey-on-accent' as string]: 'var(--color-yellow)',
                ['--journey-cta-bg' as string]: 'var(--color-purple)',
                ['--journey-cta-text' as string]: 'var(--color-yellow)',
              } as React.CSSProperties
            }
            {...(prefersReducedMotion
              ? {
                  initial: false as const,
                  animate: { opacity: isExiting ? 0 : 1 },
                  transition: { duration: 0.16 },
                }
              : {
                  initial: DAMPED_SLAM_INITIAL,
                  animate: isExiting ? DAMPED_SLAM_INITIAL : DAMPED_SLAM_ANIMATE,
                  transition: SLAM_SPRING,
                })}
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

        <motion.div layout ref={bodyScrollRef} className="solo-focus-body-scroll w-full min-w-0">
        <div className="solo-focus-rail w-full min-w-0">
        <motion.div
          layout
          className="solo-focus-stack flex flex-col items-stretch justify-start w-full min-w-0"
        >
          {/* Hero + metrics + actions */}
            <motion.div
              key={`sf-hero-${morphDeckCursor}-${displayJourneyId}-${String(activeCardId ?? 'base')}`}
              className="solo-focus-shell solo-focus-mother solo-focus-content-stack w-full min-w-0"
            >
            <div className="solo-focus-expanded-toolbar solo-focus-mother-columns w-full min-w-0">
              <div className="solo-focus-mother-copy flex-1 min-w-0 flex flex-col items-stretch w-full min-w-0">
              <div className="flex flex-col gap-2 w-full min-w-0">
              <motion.h5
                layout
                className="solo-focus-category zz-label m-0 text-left"
                style={{ color: 'var(--journey-text)', fontSize: 'var(--zz-h4-mobile)', lineHeight: 0.8 }}
                initial={DAMPED_SLAM_INITIAL}
                animate={DAMPED_SLAM_ANIMATE}
                transition={{ ...SLAM_SPRING, delay: 0.05 }}
              >
                {String(displayJourneyId || journeyId || '').replace(/-/g, ' ').toUpperCase()}
              </motion.h5>
            {physicalSoloHref ? (
              <motion.a
                href={physicalSoloHref}
                target="_blank"
                rel="noopener noreferrer"
                className="solo-focus-insight-bridge w-full min-w-0"
                variants={FADE_VARIANTS}
                onClick={() => triggerHaptic('light')}
              >
                <motion.h3
                  layoutId={`headline-${journeyId}`}
                  className="solo-focus-recommendation-headline solo-focus-content-text text-marvin uppercase text-left zz-h3"
                  style={{
                    fontFamily: 'var(--font-marvin)',
                    fontWeight: 700,
                    lineHeight: 0.8,
                    color: 'var(--journey-text)',
                    margin: 0,
                    padding: 0,
                  }}
                  {...WORD_APPEAR}
                >
                  {recommendationTitle}
                </motion.h3>
                <motion.p
                  className="solo-focus-insight solo-focus-description solo-focus-scraped-tip solo-focus-copy-width solo-focus-content-text text-left"
                  style={{
                    color: 'var(--journey-text)',
                    margin: 0,
                  }}
                  variants={FADE_VARIANTS}
                >
                  {insightDisplay}
                </motion.p>
              </motion.a>
            ) : (
              <>
                <motion.h3
                  layoutId={`headline-${journeyId}`}
                  className="solo-focus-recommendation-headline solo-focus-content-text text-marvin uppercase text-left zz-h3"
                  style={{
                    fontFamily: 'var(--font-marvin)',
                    fontWeight: 700,
                    lineHeight: 0.8,
                    color: 'var(--journey-text)',
                    margin: 0,
                    padding: 0,
                  }}
                  {...WORD_APPEAR}
                >
                  {recommendationTitle}
                </motion.h3>
                <motion.p
                  className="solo-focus-insight solo-focus-description solo-focus-scraped-tip solo-focus-copy-width solo-focus-content-text text-left"
                  style={{ color: 'var(--journey-text)', margin: 0 }}
                  variants={FADE_VARIANTS}
                >
                  {insightDisplay}
                </motion.p>
              </>
            )}

            <motion.p
              className="solo-focus-supplied-by headline-to-insight text-left w-full min-w-0"
              style={{
                color: 'var(--journey-text)',
                margin: 0,
                opacity: 0.92,
              }}
              variants={FADE_VARIANTS}
            >
              Supplied by {diagnosticProviderJourney}
            </motion.p>
            {profilePostcode && locationPhrase ? (
              <motion.p
                className="solo-focus-location-tag zz-body solo-focus-copy-width text-left m-0"
                style={{ color: 'var(--journey-text)', opacity: 0.9 }}
                variants={FADE_VARIANTS}
              >
                {locationPhrase}
              </motion.p>
            ) : null}

            {architectActionLine?.trim() ? (
              <motion.p
                className="solo-focus-action-line solo-focus-copy-width solo-focus-content-text text-left"
                style={{
                  color: 'var(--journey-text)',
                  margin: 0,
                  opacity: 0.95,
                }}
                variants={FADE_VARIANTS}
              >
                {architectActionLine.trim()}
              </motion.p>
            ) : null}
              </div>
            <motion.div
              className={`solo-focus-impact-hero insight-to-impact card-impact-grid solo-focus-impact-grid grid grid-cols-2 gap-x-10 gap-y-0 w-full min-w-0${impactAnswerPulse ? ' solo-focus-impact-answer-pulse' : ''}`}
              variants={FADE_VARIANTS}
            >
            <div className="solo-focus-data-stack data-stack data-stack--tight">
              <span className="data-label" style={{ color: 'var(--color-ink)' }}>
                SAVE
              </span>
              <span
                className="data-value solo-focus-data-value data-stamp-metric"
                style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}
              >
                <StampedMoneyGbp gbp={animatedMoneyGbp} />
              </span>
            </div>
            <div className="solo-focus-data-stack data-stack data-stack--tight data-stack--secondary solo-focus-carbon-stack">
              <span className="data-label" style={{ color: 'var(--color-ink)' }}>
                CARBON
              </span>
              <span
                className="data-value solo-focus-data-value data-stamp-metric"
                style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}
              >
                <StampedCarbonKg kg={animatedCarbonKg} />
              </span>
            </div>
          </motion.div>
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
                  onClick={() => {
                    triggerHaptic('medium')
                    handleCloseStart()
                  }}
                  whileTap={{ scale: 0.96 }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ transformOrigin: 'top right' }}
                >
                  <BackArrowDownLeft size={24} />
                </motion.button>
                {(onLike && (activeCardId || cardId)) || onAskZai ? (
                  <motion.div
                    className="solo-focus-utility-row flex flex-col items-end justify-start shrink-0"
                    style={{ gap: 20 }}
                    variants={FADE_VARIANTS}
                  >
                    {onLike && (activeCardId || cardId) && (
                      <motion.button
                        type="button"
                        className="circle-btn solo-focus-action-btn solo-focus-action-80"
                        onClick={() => {
                          triggerHaptic('medium')
                          const id = String(activeCardId || cardId)
                          onLike(id, displayTitle, parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)))
                        }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ ...SPRING_TAP, delay: 0.07 }}
                        aria-label="Like"
                        style={{
                          backgroundColor: isLiked
                            ? 'var(--journey-cta-text)'
                            : 'var(--journey-cta-bg)',
                          color: isLiked ? 'var(--journey-cta-bg)' : 'var(--journey-cta-text)',
                        }}
                      >
                        <svg width={18} height={18} viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </motion.button>
                    )}
                    {onAskZai && (
                      <motion.button
                        type="button"
                        className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-ask-zai-btn"
                        onClick={() => {
                          triggerHaptic('medium')
                          const allAnswers: Record<string, any> = {}
                          if (typeof window !== 'undefined') {
                            try {
                              const keys = Object.keys(localStorage).filter(k => k.startsWith('journey_') && k.endsWith('_answers'))
                              keys.forEach(k => {
                                const jid = k.replace('journey_', '').replace('_answers', '')
                                allAnswers[jid] = JSON.parse(localStorage.getItem(k) || '{}')
                              })
                            } catch {}
                          }
                          setAskZaiContext({
                            category: journeyId,
                            personalSpend: moneyValue.replace(/^£\s*/, '').trim() || '0',
                            regionalAvg: carbonValue.replace(/\s*(kg|t)\s*CO₂$/i, '').trim() || '0',
                            question: buildSoloFocusAskZaiQuestion(displayTitle, soloEmbedQuestionLabel),
                            journey_question_label: soloEmbedQuestionLabel,
                            scraped_source: insightLabel || crawlerTip || localContextBar || '',
                            journey_answers_jsonb: allAnswers
                          })
                          onClose?.()
                          onAskZai()
                        }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ ...SPRING_TAP, delay: 0.14 }}
                        aria-label="Ask Zai about this"
                      >
                        <span className="solo-focus-ask-zai-visual" aria-hidden>
                          <svg
                            width={18}
                            height={18}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 0 1 11.5 3.5h1A8.5 8.5 0 0 1 21 12z" />
                            <circle cx="9.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
                            <circle cx="12.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
                            <circle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
                          </svg>
                        </span>
                      </motion.button>
                    )}
                  </motion.div>
                ) : null}
              </div>
            </div>

            <motion.div
              className="solo-focus-trinity impact-to-trinity flex flex-row items-center justify-start flex-shrink-0 w-full"
              style={{
                gap: 20,
                marginTop: 0,
                marginBottom: 0,
              }}
              variants={FADE_VARIANTS}
            >
            {physicalSoloHref && (
              <IndustrialHandoffButton
                url={profilePostcode?.toUpperCase().startsWith('KW') && displayJourneyId === 'home' ? 'https://www.homeenergyscotland.org/' : physicalSoloHref}
                journeyId={displayJourneyId as string}
                moneyValue={parseMoneyGbpFromImpactDisplay(String(displayMoneyValue))}
                ctaLabel="CLAIM"
              />
            )}
            </motion.div>
            </motion.div>

          {/* Question / Result — below hero stack */}
          <motion.div
            className={`solo-focus-shell solo-focus-child solo-focus-loop trinity-to-question flex-shrink-0 w-full flex flex-col items-start view-expanded solo-focus-trap-block${loopZipCollapsing ? ' solo-focus-loop--posting' : ''}`}
            variants={FADE_VARIANTS}
          >
            <AnimatePresence mode="wait">
              {viewState === 'RESULT' ? (
                <motion.div
                  key={`sf-result-${discoverySnap?.questionId ?? 'q'}-${String(discoverySnap?.answerValue ?? '').slice(0, 24)}-${currentMorphData?.id ?? activeCardId ?? 'base'}`}
                  {...soloFocusSlamMotionProps(reducePagerMotion, false)}
                  className="flex flex-col items-start w-full gap-10"
                  style={{ gap: 40, transformOrigin: '50% 50%' }}
                >
                  {journeyId === 'home' ? (
                    <motion.p
                      className="zz-body-bold solo-focus-copy-width text-left m-0"
                      style={{
                        color: 'var(--journey-text)',
                        fontFamily: 'var(--font-roboto)',
                        fontWeight: 800,
                      }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    >
                      Save £{PRICE_CAP_SAVING_APRIL_1} on 1 April — typical cap {formatZoneCardMoney(PRICE_CAP_MARCH_2026)}/yr →{' '}
                      {formatZoneCardMoney(PRICE_CAP_APRIL_2026)}/yr.
                    </motion.p>
                  ) : null}
                  {birthedZoneTitle ? (
                    <motion.p
                      className="zz-body-bold solo-focus-copy-width text-left m-0"
                      style={{
                        color: 'var(--journey-text)',
                        fontFamily: 'var(--font-marvin)',
                        fontWeight: 700,
                      }}
                      initial={DAMPED_SLAM_INITIAL}
                      animate={DAMPED_SLAM_ANIMATE}
                      transition={SLAM_SPRING}
                    >
                      {wrapResultSupportingAsterisks(`We found a new win! ${birthedZoneTitle} is now in your Zone.`)}
                    </motion.p>
                  ) : null}
                  {gridContext?.cleaner_vs_2025_pct != null ? (
                    <motion.p
                      className="zz-body-bold solo-focus-copy-width text-left m-0"
                      style={{ color: 'var(--journey-text)', fontFamily: 'var(--font-roboto)', fontWeight: 800 }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {wrapResultSupportingAsterisks(
                        `Grid is ${gridContext.cleaner_vs_2025_pct}% cleaner than 2025. Your win just got bigger.`
                      )}
                    </motion.p>
                  ) : null}
                  {discovery ? (
                    <>
                      {discoveryWinLine ? (
                        <motion.p
                          className="zz-body-bold solo-focus-copy-width text-left m-0"
                          style={{
                            color: 'var(--journey-text)',
                            fontFamily: 'var(--font-roboto)',
                            fontWeight: 800,
                          }}
                          initial={DAMPED_SLAM_INITIAL}
                          animate={DAMPED_SLAM_ANIMATE}
                          transition={SLAM_SPRING}
                        >
                          {wrapResultSupportingAsterisks(discoveryWinLine)}
                        </motion.p>
                      ) : geminiRecommendationCopy ? (
                        <motion.p
                          className="zz-body-bold solo-focus-copy-width text-left m-0"
                          style={{
                            color: 'var(--journey-text)',
                            fontFamily: 'var(--font-roboto)',
                            fontWeight: 800,
                          }}
                          initial={DAMPED_SLAM_INITIAL}
                          animate={DAMPED_SLAM_ANIMATE}
                          transition={SLAM_SPRING}
                        >
                          {wrapResultSupportingAsterisks(geminiRecommendationCopy)}
                        </motion.p>
                      ) : null}
                      <motion.p
                        className="zz-body-bold solo-focus-copy-width text-left m-0"
                        style={{ color: 'var(--journey-text)' }}
                        initial={DAMPED_SLAM_INITIAL}
                        animate={DAMPED_SLAM_ANIMATE}
                        transition={{
                          ...SLAM_SPRING,
                          delay: discoveryWinLine || geminiRecommendationCopy ? 0.06 : 0,
                        }}
                      >
                        {wrapResultSupportingAsterisks(
                          `UK average saving for ${discovery.sav.answerLabel} is £${formatMoneyImpact(Math.round(discovery.sav.gbp))}.`
                        )}
                      </motion.p>
                      {discoveryImpactKg > 0 ? (
                        <>
                          <motion.p
                            className="zz-body-bold solo-focus-copy-width text-left m-0"
                            style={{
                              color: 'var(--journey-text)',
                              fontFamily: 'var(--font-roboto)',
                              fontWeight: 800,
                            }}
                            initial={DAMPED_SLAM_INITIAL}
                            animate={DAMPED_SLAM_ANIMATE}
                            transition={{ ...SLAM_SPRING, delay: 0.07 }}
                          >
                            {wrapResultSupportingAsterisks(
                              `IMPACT: −${
                                discoveryImpactKg >= 1000
                                  ? `${(discoveryImpactKg / 1000).toFixed(1)}T`
                                  : `${Math.round(discoveryImpactKg)} kg`
                              } CO₂e`
                            )}
                          </motion.p>
                          <motion.p
                            className="zz-body solo-focus-copy-width text-left m-0 opacity-95"
                            style={{ color: 'var(--journey-text)' }}
                            initial={DAMPED_SLAM_INITIAL}
                            animate={DAMPED_SLAM_ANIMATE}
                            transition={{ ...SLAM_SPRING, delay: 0.09 }}
                          >
                            {wrapResultSupportingAsterisks(
                              `That is the equivalent of planting ${treeEquivalent} trees this year.`
                            )}
                          </motion.p>
                        </>
                      ) : null}
                      <motion.p
                        className="zz-body-bold solo-focus-copy-width text-left m-0"
                        style={{ color: 'var(--journey-text)' }}
                        initial={DAMPED_SLAM_INITIAL}
                        animate={DAMPED_SLAM_ANIMATE}
                        transition={{ ...SLAM_SPRING, delay: 0.08 }}
                      >
                        {wrapResultSupportingAsterisks(
                          `${discovery.rec.headline.replace(/_/g, ' ')} — ${discovery.rec.body}`
                        )}
                      </motion.p>
                      <motion.p
                        className="zz-body solo-focus-copy-width text-left m-0 opacity-95"
                        style={{ color: 'var(--journey-text)' }}
                        initial={DAMPED_SLAM_INITIAL}
                        animate={DAMPED_SLAM_ANIMATE}
                        transition={{ ...SLAM_SPRING, delay: 0.14 }}
                      >
                        {wrapResultSupportingAsterisks(
                          `You’re on track — save £${formatMoneyImpact(moneyValue)} and ${formatCarbonImpact(carbonValue).value} ${formatCarbonImpact(carbonValue).unit} from this journey.`
                        )}
                      </motion.p>
                    </>
                  ) : (
                    <p className="zz-body-bold solo-focus-copy-width text-left m-0" style={{ color: 'var(--journey-text)' }}>
                      {wrapResultSupportingAsterisks(
                        `You’re on track — save £${formatMoneyImpact(moneyValue)} and ${formatCarbonImpact(carbonValue).value} ${formatCarbonImpact(carbonValue).unit} from this move.`
                      )}
                    </p>
                  )}
                  {journeyId === 'home' && (() => {
                    const fromDiscovery =
                      discoverySnap?.questionId === 'energy_type' && discoverySnap.answerValue.toUpperCase() === 'GAS'
                    let fromStorage = false
                    try {
                      if (typeof window !== 'undefined') {
                        const raw = localStorage.getItem('journey_home_answers')
                        const answers = raw ? (JSON.parse(raw) as Record<string, string>) : {}
                        fromStorage = (answers.energy_type ?? answers.heating ?? '').toUpperCase() === 'GAS'
                      }
                    } catch {
                      fromStorage = false
                    }
                    if (!fromDiscovery && !fromStorage) return null
                    const grantGbp = regionalHeatPumpGrantGbp(profilePostcode)
                    const grantLine = isScottishPostcodeArea(profilePostcode)
                      ? `${formatZoneCardMoney(grantGbp)} Home Energy Scotland / rural uplift`
                      : `${formatZoneCardMoney(grantGbp)} Boiler Upgrade`
                    return (
                      <p className="zz-body-bold solo-focus-copy-width text-left m-0" style={{ color: 'var(--journey-text)' }}>
                        {grantLine}
                      </p>
                    )
                  })()}
                    <p className="zz-body solo-focus-copy-width text-left m-0 opacity-90" style={{ color: 'var(--journey-text)' }}>
                      From the top: swipe up to Zone, down for next journey. With several tips in this journey, swipe left/right between them.
                    </p>
                    {resultCitation && (
                      <p className="zz-body-small solo-focus-copy-width text-left m-0 opacity-70" style={{ color: 'var(--journey-text)' }}>
                        Verified via{' '}
                        {resultCitation.url ? (
                          <a
                            href={resultCitation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'underline' }}
                          >
                            {resultCitation.label}
                          </a>
                        ) : (
                          resultCitation.label
                        )}
                        {resultCitation.verifiedAt ? ` — ${resultCitation.verifiedAt}` : ''}
                      </p>
                    )}
                  </motion.div>
              ) : (
                <motion.div
                  key="solo-focus-question-wrap"
                  className="w-full flex flex-col items-start"
                  {...soloFocusSlamMotionProps(reducePagerMotion, false)}
                  style={{ transformOrigin: '50% 50%' }}
                >
                  <EmbeddedJourneyQuestion
                    journeyId={journeyId}
                    sessionLaneKey={String(cardId ?? journeyId)}
                    onClose={onClose}
                    onJourneyAnswered={onJourneyAnswered}
                    triggerHaptic={triggerHaptic}
                    textColor="var(--sf-prose-contrast)"
                    onActiveQuestionLabelChange={setSoloEmbedQuestionLabel}
                    soloFocusZipShut
                    onZipShutStart={() => setLoopZipCollapsing(true)}
                    onZipShutEnd={() => {
                      // We handle zip open explicitly in onSoloFocusPostSuccess now
                    }}
                    onSoloEmbedComplete={() => onSoloEmbedComplete?.(journeyId)}
                    deferJourneyAnsweredForZipRebirth
                    onSoloFocusPostSuccess={(payload) => {
                      const {
                        questionId,
                        answerValue,
                        discovery,
                        discovery_win,
                        new_discovery_card,
                        grid_context,
                        morphCards,
                        researchAttribution: ra,
                        sourceCitation: citeSnap,
                        hasNextQuestion,
                        newTotals,
                        sentinelMotherRefresh,
                      } = payload
                      if (journeyId === 'home' && sentinelMotherRefresh) {
                        const parsed = parseSentinelMotherRefresh(
                          sentinelMotherRefresh as SentinelMotherRecardPayload
                        )
                        if (parsed) {
                          setHomeSentinelRecard(parsed)
                        }
                      }
                      if (
                        newTotals &&
                        typeof newTotals.totalMoney === 'number' &&
                        typeof newTotals.totalCarbon === 'number'
                      ) {
                        setHeroTotalsOverride({
                          money: Math.max(0, Math.round(newTotals.totalMoney)),
                          carbon: Math.max(0, Math.round(newTotals.totalCarbon)),
                        })
                      }
                      const handoffLine =
                        pickOfferLineFromAnswerMorph(morphCards, discovery_win, discovery) ||
                        'Your next saving is one step away — open the next category to continue.'
                      
                      // 2. Swap content (Commit)
                      const prevDeckLen = morphDeckLenRef.current
                      if (citeSnap && typeof citeSnap.label === 'string' && citeSnap.label.trim()) {
                        setResultCitation({
                          label: citeSnap.label.trim(),
                          url: typeof citeSnap.url === 'string' ? citeSnap.url : undefined,
                          verifiedAt: typeof citeSnap.verifiedAt === 'string' ? citeSnap.verifiedAt : undefined,
                        })
                      }
                      if (ra && (ra.headline != null || ra.supplied_by != null)) {
                        setResearchAttribution(ra)
                      }
                      const fallbackMorphCard = getNextMorphCard(journeyId, {
                        postcode: state.profile?.postcode,
                        homeType: state.profile?.homeType,
                        transport: state.profile?.transport,
                        fuelType:
                          journeyId === 'travel'
                            ? (state.journeyAnswers?.travel?.fuel_type ?? null)
                            : journeyId === 'home'
                              ? (state.journeyAnswers?.home?.energy_type ?? null)
                              : null,
                      })
                      const incomingMorphCards =
                        hasNextQuestion === false
                          ? morphCards && morphCards.length > 0
                            ? morphCards
                            : [fallbackMorphCard]
                          : []
                      if (incomingMorphCards.length > 0) {
                        pagerEnterDir.current = 1
                        const prevLen = prevDeckLen
                        let nextLen = 0
                        const prioritized = prioritizeMorphCardsForContext(incomingMorphCards, {
                          postcode: profilePostcode,
                          local: state.locationState?.local ?? null,
                          profile: state.profile,
                          journeyAnswers: state.journeyAnswers as Record<string, Record<string, string>>,
                        })
                        flushSync(() => {
                          setMorphDeck((prev) => {
                            const next = [...prev, ...prioritized]
                            nextLen = next.length
                            morphDeckLenRef.current = nextLen
                            return next
                          })
                        })
                        setMorphDeckCursor(prevLen + 1)
                      }
                      const du =
                        discovery?.source_url && typeof discovery.source_url === 'string'
                          ? discovery.source_url.trim()
                          : ''
                      setLiveClaimUrl(du.startsWith('http') ? du : null)
                      setDiscoverySnap({ questionId, answerValue })
                      const win = typeof discovery_win === 'string' ? discovery_win.trim() : ''
                      setDiscoveryWinLine(win || null)
                      const born =
                        typeof new_discovery_card?.title === 'string' ? new_discovery_card.title.trim() : ''
                      setBirthedZoneTitle(born || null)
                      if (grid_context && typeof grid_context === 'object') {
                        setGridContext({
                          intensity_g_per_kwh:
                            typeof grid_context.intensity_g_per_kwh === 'number'
                              ? grid_context.intensity_g_per_kwh
                              : null,
                          cleaner_vs_2025_pct:
                            typeof grid_context.cleaner_vs_2025_pct === 'number'
                              ? grid_context.cleaner_vs_2025_pct
                              : null,
                        })
                      } else {
                        setGridContext(null)
                      }
                      setGeminiRecommendationCopy(
                        typeof discovery?.recommendation_copy === 'string' && discovery.recommendation_copy.trim()
                          ? discovery.recommendation_copy.trim()
                          : null
                      )
                      if (hasNextQuestion === true) {
                        persistViewState('QUESTION', { preserveResultContext: true })
                      } else {
                        persistViewState('RESULT')
                      }
                      
                      onJourneyAnswered?.()
                      onEmbeddedAnswerSuccess?.({ cardId, journeyId })

                      // 3. Zip-open with the new card instantly
                      setLoopZipCollapsing(false)
                      
                      if (hasNextQuestion === false && onAdvanceToNextJourneyAfterAnswer) {
                        window.setTimeout(() => {
                          onAdvanceToNextJourneyAfterAnswer({
                            fromJourneyId: journeyId,
                            offerLine: handoffLine,
                          })
                        }, 220)
                      }
                    }}
                    onSourceCitation={(c) => setResultCitation(c)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
        </div>
        <div
          className="solo-focus-pager-rail"
          aria-label="Card pager"
          aria-live="polite"
          data-solo-focus-no-swipe
        >
          {Array.from({ length: pagerPageCount }).map((_, i) => (
            <button
              type="button"
              key={`pip-${i}`}
              className={`pager-pip${i === morphDeckCursor ? ' pager-pip--active' : ''}`}
              aria-label={`Go to tip ${i + 1}`}
              aria-pressed={i === morphDeckCursor}
              onClick={() => handlePagerSelect(i)}
            />
          ))}
        </div>

        </motion.div>
      </motion.div>
      </motion.div>
      ) : null
    )

    if (typeof document !== 'undefined' && document.body) {
      return createPortal(expandedOverlay, document.body)
    }
    return null
  }

  // —— COLLAPSED: Zero Zero Card Spec — Label (top-left), Arrow 3× (top-right, hover hint), Headline, Data Stack ——

  const cardLabelHeight = 14
  const arrowSize = cardLabelHeight * 3

  return (
      <motion.div
        layout
        layoutId={`card-${journeyId}`}
        data-journey={journeyId}
        onClick={() => {
          triggerHaptic('medium')
          onExpand?.()
        }}
        className={`bento-card-groovy cursor-pointer w-full h-auto ${isTall ? 'span-tall-block' : ''}`.trim()}
        style={{
          background: color,
          color: textColor,
          ['--color-ink' as string]: textColor,
          height: 'auto',
          ...(isTall && { minHeight: '100%' }),
        }}
        whileTap={{ scale: 0.96, rotate: -0.5 }}
        transition={{ type: "spring", stiffness: 550, damping: 32, mass: 1 }}
      >
      <div className="flex items-center justify-between w-full shrink-0">
        <span className="card-top-label" style={{ color: textColor }}>
          {String(journeyId ?? '').replace(/-/g, ' ').toUpperCase()}
        </span>
        <span className="card-top-arrow card-top-arrow--hint flex items-center justify-center flex-shrink-0" style={{ width: arrowSize, height: arrowSize, color: 'currentColor', background: 'transparent' }} aria-hidden>
          <svg width={arrowSize} height={arrowSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </span>
      </div>
      <motion.h2
        layoutId={`headline-${journeyId}`}
        className="card-headline"
        lang="en"
        style={{ color: textColor }}
      >
        {headline}
      </motion.h2>
      <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0">
        <div className="data-stack data-stack--tight">
          <span className="data-label text-data" style={{ color: textColor }}>SAVE</span>
          <span className="data-value text-data data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
            <StampedMoneyGbp gbp={parseMoneyGbpFromDisplay(moneyValue || '0')} />
          </span>
        </div>
        <div className="data-stack data-stack--tight data-stack--secondary">
          <span className="data-label" style={{ color: textColor }}>CARBON</span>
          <span className="data-value data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
            <StampedCarbonKg kg={parseCarbonKgFromDisplay(carbonValue || '0')} />
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export { EmbeddedJourneyQuestion } from '@/app/components/EmbeddedJourneyQuestion'
