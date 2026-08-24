'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { type JourneyId } from '@/lib/journeys'
import {
  resolveZoneSurfaceKind,
  zoneExpandedJourneySurfaceStyleProps,
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
import { SoloFocusViewportUtilityStrip } from '@/app/components/SoloFocusViewportUtilityStrip'
import { ExpandedCardShell } from '@/app/components/ExpandedCard'
import type { ZoneAuditState } from '@/lib/zone/zoneAuditUi'
import { SoloFocusJourneyNav } from '@/app/components/SoloFocusJourneyNav'
import { SoloFocusProseStack } from '@/app/components/SoloFocusProseStack'
import { SoloFocusMotherStack } from '@/app/components/SoloFocusMotherStack'
import { MotherCardRenderer } from '@/app/components/MotherCardRenderer'
import { AskZaiDeepDiveSheet } from '@/app/components/AskZaiDeepDiveSheet'
import { isZaiChatEnabled, isDislikeEnabled } from '@/lib/featureFlags'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import { pickPrimaryHttpUrl } from '@/lib/soloFocusDiagnosticMeta'
import { resolveSoloFocusHandoffAttribution } from '@/lib/soloFocusSuppliedBy'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { useSoloFocusHudBodyClass } from '@/lib/hooks/useSoloFocusHudBodyClass'
import {
  INDUSTRIAL_OPACITY_SNAP,
  SOLO_FOCUS_CONTENT_SNAP_DELAY_SEC,
  SOLO_FOCUS_CONTENT_SNAP_INITIAL,
  SOLO_FOCUS_CONTENT_SNAP_ANIMATE,
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
  headlineFromExpandedHook,
  headlineFromRockHabitForSoloFocus,
  headlineFromTitle,
  formatZoneCategoryLabel,
  formatSoloFocusTopCategoryLabel,
  zoneCardHeadlineFromRaw,
  clampZoneBentoHeadline,
  clampRockTipHeadline,
  MAX_EXPANDED_VIEW_HEADLINE_WORDS,
  MIN_EXPANDED_VIEW_HEADLINE_WORDS,
  MAX_ZONE_CARD_HEADLINE_WORDS,
  resolveExpandedTrueTipInsight,
  shouldShowSoloFocusArchitectActionLine,
  resolveSoloFocusHandoffUrls,
  resolveSoloFocusCtaLabel,
  stripExpandedCardTitleNoise,
  wrapResultSupportingAsterisks,
  isAcceptableZoneJourneyHeadline,
} from '@/lib/soloFocusCopy'
import { isLibraryActionCardId } from '@/lib/actions/actionLibrary'
import { sanitizeArchitectProseForJourney } from '@/lib/zone/contentProseSanitize'
import {
  shouldShowZoneEstimatedInsightStrip,
  ZONE_ESTIMATED_INSIGHT_STRIP,
} from '@/lib/zone/zoneAuditUi'
import { useApp } from '@/app/context/AppContext'
import { recordOfferSignal } from '@/lib/zone/offerSignals'
import {
  createSoloFocusEngagementRef,
  flushSoloFocusIndifferent,
  markSoloFocusEngagement,
} from '@/lib/zone/soloFocusEngagement'
import { normalizeCategoryToJourneyKey, trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import { useCountUp } from '@/lib/utils/useCountUp'
import { parseMoneyGbpFromImpactDisplay, parseCarbonKgFromImpactDisplay } from '@/lib/soloFocusImpactParse'
import { useSoloFocusExpandedGestures } from '@/lib/hooks/useSoloFocusExpandedGestures'
import {
  pickFirstHttpUrl,
} from '@/lib/zone/verifiedRevenue'
import {
  filterMorphDeckForJourney,
  morphDeckAlignedWithJourney,
  resolveFocusCategoryJourneyId,
} from '@/lib/zone/focusCategory'
import {
  mergeMorphDeckIntoNavRing,
  stepSoloFocusNavRing,
  type SoloFocusNavEntry,
} from '@/lib/zone/soloFocusJourneyNav'
import {
  triggerScrapeSyncForCategory,
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import { openOfferUrlInNewTab } from '@/lib/zone/tier2RecursiveSpawner'
import { openZoneExternalHandoff } from '@/lib/zone/zoneHandoff'
import { clearSoloFocusMemory } from '@/lib/zone/sessionMemory'
import {
  persistSoloFocusCardContext,
  normalizeSoloFocusJourneyId,
} from '@/lib/zone/soloFocusCardContext'
import { buildDeepDiveQuestionPills } from '@/lib/zai/deepDiveAudit'
import { useVisitedCardIds } from '@/lib/hooks/useVisitedCardIds'
import { setDeepDiveInProgress } from '@/lib/zone/visitedCards'
import type { PatternShiftCloseHandler, PatternShiftCloseMeta } from '@/lib/zone/patternShiftClose'
import { shouldCloseMarkPinkOnly } from '@/lib/zone/directorsOrder'
import {
  SOLO_FOCUS_SNAPSHOT_V,
  soloFocusSnapStorageKeys,
  readSoloFocusSnapshot,
  writeSoloFocusSnapshot,
  clearSoloFocusSnapshot,
  type SoloFocusResultSnapshotV1,
} from '@/lib/soloFocusSessionSnapshot'
import { getNextMorphCard } from '@/lib/zone/getNextMorphCard'
import { profileFieldsFromStorage } from '@/lib/profile/onboardingComplete'
type HomeSentinelRecard = {
  headline: string
  description: string
  moneyGbp: number
  carbonKg: number
  sourceUrl?: string
  verifiedAt?: string
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
  onLike?: (id: string, title?: string, moneyGbp?: number, journeyKey?: JourneyId, carbonKg?: number) => void
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
  /** Bottom rail: jump to prev/next card on the Zone wall (wraps). */
  onNavigateJourney?: (journeyId: JourneyId) => void
  onNavigateSoloFocus?: (entry: import('@/lib/zone/soloFocusJourneyNav').SoloFocusNavEntry) => void
  /** Wall-order ring — mother journey cells + discovery tips. */
  soloFocusNavRing?: readonly import('@/lib/zone/soloFocusJourneyNav').SoloFocusNavEntry[]
  /** @deprecated Prefer `soloFocusNavRing`. */
  soloFocusJourneyRing?: readonly JourneyId[]
  /**
   * After the last question in this journey is answered: close expanded view and let the shell
   * open the next journey in wall order, using `offerLine` as contextual copy on that tile.
   */
  /** v35.0 verified audit citation + revenue handoff */
  verifiedSourceName?: string | null
  verifiedSourceDate?: string | null
  partnerLink?: string | null
  /** v42.8 — Zone VM audit gate; when LIVE, expanded header stays VERIFIED with locality. */
  auditState?: ZoneAuditState | null
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
  onNavigateJourney,
  onNavigateSoloFocus,
  soloFocusNavRing,
  soloFocusJourneyRing,
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
  const reduceMotion = useHydrationSafeReducedMotion()
  const { state, toggleDislike } = useApp()
  const { isUnreadCard } = useVisitedCardIds()
  const profilePostcode =
    (state.profile?.postcode ?? '').replace(/\s+/g, '').trim().toUpperCase() ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('profile_postcode') ?? '').replace(/\s+/g, '').trim().toUpperCase()
      : '') ||
    null
  const effectiveOpen = kineticGrid ? isExpanded : false
  const [isExiting, setIsExiting] = useState(false)
  useSoloFocusHudBodyClass(kineticGrid && (effectiveOpen || isExiting))
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
  /**
   * Ranked-wall cards (`journey-<actionId>`) carry their own short, real title — same shape as a
   * Rock habit title. The generic collapsed-tile path (`clampZoneBentoHeadline`) substitutes the
   * hardcoded per-category `ZONE_BENTO_HOOK` whenever a title reads as "low quality" (which a
   * concise 4-6 word library title reliably does), silently replacing it — live-confirmed: every
   * one of a category's distinct library cards rendered the exact same `ZONE_BENTO_HOOK` string on
   * the wall tile itself (e.g. two different FOOD actions both showing "plan meals from food you
   * already have to cut waste"), even though the underlying data was correct all along — verified
   * via the actual `title` prop on each mounted card. `clampRockTipHeadline` already solves this
   * for Rock/Tips ("never substitute journey wall hooks"); reused here for the same reason.
   */
  const isLibraryWallCard = isLibraryActionCardId(cardId ?? '')
  const headline = isLibraryWallCard
    ? clampRockTipHeadline(title || String(journeyId ?? ''))
    : clampZoneBentoHeadline(
        zoneCardHeadlineFromRaw(
          title || String(journeyId ?? ''),
          formatZoneCategoryLabel(String(journeyId ?? 'home')),
          MAX_ZONE_CARD_HEADLINE_WORDS
        ),
        String(journeyId ?? 'home')
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
  const [askZaiDeepDiveOpen, setAskZaiDeepDiveOpen] = useState(false)
  const soloFocusEngagementRef = useRef(createSoloFocusEngagementRef())
  const [heroTotalsOverride, setHeroTotalsOverride] = useState<{ money: number; carbon: number } | null>(null)
  const [homeSentinelRecard, setHomeSentinelRecard] = useState<HomeSentinelRecard | null>(null)
  const prevIsExpandedRef = useRef(false)
  const patternShiftAfterExitRef = useRef<PatternShiftCloseMeta | null>(null)
  const currentMorphData =
    morphDeckCursor > 0 && morphDeck[morphDeckCursor - 1] != null
      ? morphDeck[morphDeckCursor - 1]
      : null
  /* getNextMorphCard() seeds morphDeck from ROCK_HABITS only (rock-<slug> ids) — never from
     discovery/injected cards, which live in the separate zone/page.tsx tip-grid flow, not here. */
  const isRockMorphTip = String(currentMorphData?.id ?? '').startsWith('rock-')

  const sentinelMoneyCarbon =
    journeyId === 'home' && homeSentinelRecard && !currentMorphData
      ? { money: `£${homeSentinelRecard.moneyGbp}`, carbon: `${homeSentinelRecard.carbonKg}kg CO₂` }
      : null

  const focusCategoryJourneyId = resolveFocusCategoryJourneyId(journeyId, currentMorphData?.journey_key)
  const displayJourneyId = (currentMorphData?.journey_key ?? journeyId) as JourneyId
  const activeJourneyId = normalizeSoloFocusJourneyId(String(displayJourneyId))
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

  useEffect(() => {
    soloFocusEngagementRef.current.current = 'none'
  }, [activeCardId, cardId])

  const soloFocusNavRingWithMorph = useMemo(
    () =>
      mergeMorphDeckIntoNavRing(
        soloFocusNavRing ?? [],
        focusCategoryJourneyId,
        morphDeck,
        cardId ?? `journey-${journeyId}`
      ),
    [soloFocusNavRing, focusCategoryJourneyId, morphDeck, cardId, journeyId]
  )

  const handleNavigateSoloFocusEntry = useCallback(
    (entry: SoloFocusNavEntry) => {
      const morphIdx = morphDeck.findIndex((m) => m?.id === entry.cardId)
      if (morphIdx >= 0) {
        setMorphDeckCursor(morphIdx + 1)
        return
      }
      const motherId = cardId ?? `journey-${journeyId}`
      if (entry.kind === 'journey' && entry.cardId === motherId) {
        setMorphDeckCursor(0)
        return
      }
      onNavigateSoloFocus?.(entry)
    },
    [morphDeck, cardId, journeyId, onNavigateSoloFocus]
  )

  const moneyTargetGbp = parseMoneyGbpFromImpactDisplay(displayMoneyValue)
  const carbonTargetKg = parseCarbonKgFromImpactDisplay(displayCarbonValue)
  const journeyResearchCov = researchCategoryCoverage?.[focusCategoryJourneyId]
  const focusJourneyKey = normalizeCategoryToJourneyKey(focusCategoryJourneyId)
  const sanitizedCovProse = journeyResearchCov?.architectProse?.trim()
    ? sanitizeArchitectProseForJourney(focusJourneyKey, journeyResearchCov.architectProse)
    : null
  /* Rock Habit morph and ranked-library wall cards both have their own specific prose/£/source —
     category-level research_results must not silently override either, mirroring
     isCategoryScopedOverrideExempt in zone/page.tsx (888c566). The props are already nulled at
     the source for library cards (page.tsx); this is belt-and-braces, same as the Rock-tip guard. */
  const verifiedAuditMatchesJourney =
    !isRockMorphTip &&
    !isLibraryWallCard &&
    verifiedAuditMoneyGbp != null &&
    Number.isFinite(verifiedAuditMoneyGbp) &&
    (verifiedAuditCategory ?? '').trim().toLowerCase() === focusCategoryJourneyId &&
    Boolean(
      (verifiedArchitectProse?.trim() && sanitizeArchitectProseForJourney(focusJourneyKey, verifiedArchitectProse)) ||
        sanitizedCovProse
    )
  const researchSettled = journeyResearchSettled(journeyResearchCov, {
    streamPending: insightGenerationPending,
    journeyId: focusJourneyKey,
  })
  const collapsedMoneyGbp = parseMoneyGbpFromDisplay(moneyValue || '0')
  const showEstimatedInsightStrip = shouldShowZoneEstimatedInsightStrip({
    auditState,
    researchSettled,
    moneyGbp: collapsedMoneyGbp,
  })
  const showCardComputing =
    !researchSettled &&
    !showEstimatedInsightStrip &&
    (insightGenerationPending || researchCategoryCoverage != null)
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
  const morphCardOfferUrl = currentMorphData
    ? pickFirstHttpUrl(
        currentMorphData.actions?.actionUrl,
        currentMorphData.actions?.learnUrl
      )
    : undefined
  const morphCardSourceUrl = currentMorphData
    ? pickFirstHttpUrl(currentMorphData.source, currentMorphData.actions?.learnUrl)
    : undefined
  const soloHandoff = resolveSoloFocusHandoffUrls({
    journeyKey: focusCategoryJourneyId,
    cardOfferUrl: morphCardOfferUrl,
    cardSourceUrl: morphCardSourceUrl,
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
  const journeyCtaLabel = resolveSoloFocusCtaLabel({
    journeyKey: focusCategoryJourneyId,
    headline: String(displayTitle || title || ''),
    handoff: soloHandoff,
    moneyGbp: motherMoneyTargetGbp,
    actionType: ctaActionTypeRaw || 'learn',
    needsSwitching: ctaActionTypeRaw === 'switch',
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
      const core = cardId ?? journeyId
      const lk = `zz_sf_lane_${core}`
      const qk = `zz_sf_q_${core}`
      const snap = readHydrationSnap(soloFocusSnapKey, journeyId)
      const viewMode = 'RESULT'
      try {
        sessionStorage.removeItem(lk)
        sessionStorage.removeItem(qk)
        sessionStorage.setItem(soloFocusViewKey, viewMode)
      } catch {
        /* ignore */
      }
      setHomeSentinelRecard(null)
      /* Wall tile already has its own settled content (title/£/kg from research_results or the
         mechanical calculator) for the overwhelming majority of cards — getNextMorphCard() is a
         Rock-habit substitution with no awareness of what the wall already shows, so seeding it
         unconditionally on every first expand made the expanded card show a different headline
         and different £/kg than the tile the user just tapped (confirmed live: TECH/MONEY/WASTE
         all opened to an unrelated Rock habit instead of their own tile content). Only seed the
         fallback when the wall genuinely has nothing of its own to show yet. */
      const wallHasOwnContent = Boolean(title?.trim())
      if (wallHasOwnContent) {
        setMorphDeck([])
        setMorphDeckCursor(0)
      } else if (!snap || !Array.isArray(snap.morphDeck) || snap.morphDeck.length === 0) {
        const seeded = getNextMorphCard(journeyId, {
          postcode: profilePostcode,
          homeType: state.profile?.homeType ?? null,
          transport: state.profile?.transport ?? null,
          fuelType: state.journeyAnswers?.travel?.fuel_type ?? null,
          powerType: state.profile?.homePower ?? null,
          tenure: profileFieldsFromStorage().homeOwnership ?? null,
        })
        const seededForJourney =
          seeded.journey_key === journeyId
            ? seeded
            : { ...seeded, journey_key: journeyId, id: `morph-${journeyId}-${seeded.id}` }
        setMorphDeck([seededForJourney])
        setMorphDeckCursor(1)
      } else {
        const deck = snap.morphDeck as { journey_key?: string }[]
        if (!morphDeckAlignedWithJourney(deck, journeyId)) {
          clearSoloFocusSnapshot(soloFocusSnapKey)
          const seeded = getNextMorphCard(journeyId, {
            postcode: profilePostcode,
            homeType: state.profile?.homeType ?? null,
            transport: state.profile?.transport ?? null,
            fuelType: state.journeyAnswers?.travel?.fuel_type ?? null,
            powerType: state.profile?.homePower ?? null,
            tenure: profileFieldsFromStorage().homeOwnership ?? null,
          })
          const seededForJourney =
            seeded.journey_key === journeyId
              ? seeded
              : { ...seeded, journey_key: journeyId, id: `morph-${journeyId}-${seeded.id}` }
          setMorphDeck([seededForJourney])
          setMorphDeckCursor(1)
        } else {
          setMorphDeck(filterMorphDeckForJourney(deck, journeyId))
        }
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
    title,
    state.profile?.homeType,
    state.profile?.transport,
    state.profile?.homePower,
    state.journeyAnswers?.travel?.fuel_type,
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

  const beginCloseWithPatternShift = useCallback((exitMeta?: Partial<PatternShiftCloseMeta>) => {
    triggerHaptic('medium')
    const visitId = String(activeCardId || cardId || '').trim()
    const hasOfferFeedback =
      exitMeta?.offerFeedback === 'like' || exitMeta?.offerFeedback === 'dislike'
    if (visitId && !hasOfferFeedback) {
      flushSoloFocusIndifferent(soloFocusEngagementRef.current, {
        card_id: visitId,
        journey_key: activeJourneyId,
        card_title: displayTitle,
        money_gbp: parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)),
      })
    }
    if (!hasOfferFeedback) clearSoloFocusMemory()
    setDeepDiveInProgress(null)
    patternShiftAfterExitRef.current = {
      cardId: visitId || undefined,
      journeyId: activeJourneyId,
      visitedClose: visitId ? shouldCloseMarkPinkOnly(visitId, activeJourneyId) : false,
      ...exitMeta,
    }
    setIsExiting((prev) => (prev ? prev : true))
  }, [
    triggerHaptic,
    activeCardId,
    cardId,
    activeJourneyId,
    displayTitle,
    displayMoneyValue,
  ])

  const handleCloseStart = useCallback(() => {
    beginCloseWithPatternShift()
  }, [beginCloseWithPatternShift])

  const handleTrinityLike = useCallback(() => {
    if (!onLike || !(activeCardId || cardId)) return
    triggerHaptic('medium')
    const id = String(activeCardId || cardId)
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'like')
    onLike(
      id,
      displayTitle,
      parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)),
      activeJourneyId,
      parseCarbonKgFromImpactDisplay(String(displayCarbonValue))
    )
    recordOfferSignal({
      card_id: id,
      signal: 'like',
      journey_key: activeJourneyId,
      card_title: displayTitle,
      money_gbp: parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)),
    })
  }, [
    onLike,
    activeCardId,
    cardId,
    displayTitle,
    displayMoneyValue,
    displayCarbonValue,
    activeJourneyId,
    triggerHaptic,
  ])

  const handleTrinityDislike = useCallback(() => {
    const id = String(activeCardId || cardId || '')
    if (!id) return
    triggerHaptic('medium')
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'dislike')
    toggleDislike(
      id,
      displayTitle,
      parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)),
      activeJourneyId
    )
    beginCloseWithPatternShift({
      offerFeedback: 'dislike',
      cardTitle: displayTitle,
      cardHeadline: displayTitle,
      journeyId: activeJourneyId,
    })
  }, [
    activeCardId,
    cardId,
    toggleDislike,
    displayTitle,
    displayMoneyValue,
    activeJourneyId,
    triggerHaptic,
    beginCloseWithPatternShift,
  ])

  const handleTrinityAskZai = useCallback(() => {
    triggerHaptic('medium')
    const id = String(activeCardId || cardId || '')
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'ask')
    if (id) {
      recordOfferSignal({
        card_id: id,
        signal: 'ask',
        journey_key: activeJourneyId,
        card_title: displayTitle,
      })
    }
    setAskZaiDeepDiveOpen(true)
  }, [triggerHaptic, activeCardId, cardId, activeJourneyId, displayTitle])

  const handleTrinityCta = useCallback(() => {
    markSoloFocusEngagement(soloFocusEngagementRef.current, 'cta')
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

  const goWallRingStep = useCallback(
    (delta: -1 | 1) => {
      const ring = soloFocusNavRingWithMorph
      if (!ring.length) return
      const resolvedActive = activeCardId ?? cardId ?? `journey-${journeyId}`
      const entry = stepSoloFocusNavRing(ring, resolvedActive, focusCategoryJourneyId, delta)
      if (!entry) return
      pagerEnterDir.current = delta
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
      handleNavigateSoloFocusEntry(entry)
    },
    [
      soloFocusNavRingWithMorph,
      activeCardId,
      cardId,
      journeyId,
      focusCategoryJourneyId,
      handleNavigateSoloFocusEntry,
    ]
  )

  const expandedGestures = useSoloFocusExpandedGestures({
    scrollRef: bodyScrollRef,
    onSwipeToNewer: () => goWallRingStep(1),
    onSwipeToOlder: () => goWallRingStep(-1),
    onSwipeUpDismiss: () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15)
      handleCloseStart()
    },
    onSwipeDownNextJourney: () => {
      if (soloFocusNavRingWithMorph.length > 0 && onNavigateSoloFocus) {
        goWallRingStep(1)
        return
      }
      onSwipeNextJourney?.(journeyId)
    },
    enabled: kineticGrid && (effectiveOpen || isExiting),
  })

  useEffect(() => {
    if (!kineticGrid || !effectiveOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goWallRingStep(1)
      if (e.key === 'ArrowLeft') goWallRingStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [kineticGrid, effectiveOpen, goWallRingStep])

  useEffect(() => {
    if (isExpanded) return
  }, [isExpanded])

  const handleOpenOfferUrl = useCallback(() => {
    triggerHaptic('light')
    const target = pickPrimaryHttpUrl(soloHandoff.ctaUrl, soloHandoff.offerUrl)
    const handoffId = cardId ?? `journey-${journeyId}`
    if (target && openZoneExternalHandoff({ cardId: handoffId, url: target, title, journeyKey: journeyId })) {
      return
    }
    openOfferUrlInNewTab(target, journeyId)
  }, [soloHandoff.ctaUrl, soloHandoff.offerUrl, triggerHaptic, cardId, journeyId, title])

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
    const focusJourney = normalizeCategoryToJourneyKey(String(displayJourneyId || journeyId))
    const cleanedExpandTitle = stripExpandedCardTitleNoise(String(effectiveTitleRaw))
    const tileFallbackTitle = stripExpandedCardTitleNoise(String(title || displayTitle || journeyId))
    const mechanicalFallback = zoneCardHeadlineFromRaw(
      tileFallbackTitle || focusJourney.replace(/-/g, ' '),
      focusJourney.replace(/-/g, ' '),
      MAX_EXPANDED_VIEW_HEADLINE_WORDS
    )
    const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length
    const expandedHeadlineSource =
      isAcceptableZoneJourneyHeadline(focusJourney, cleanedExpandTitle) &&
      wordCount(cleanedExpandTitle) >= MIN_EXPANDED_VIEW_HEADLINE_WORDS
        ? cleanedExpandTitle
        : isAcceptableZoneJourneyHeadline(focusJourney, tileFallbackTitle) &&
            wordCount(tileFallbackTitle) >= MIN_EXPANDED_VIEW_HEADLINE_WORDS
          ? tileFallbackTitle
          : mechanicalFallback
    /* Rock Habit titles are short by design and almost always fail the 20-word floor —
       headlineFromExpandedHook would silently discard them for the one hardcoded sentence
       per category (EXPANDED_JOURNEY_HOOK). headlineFromRockHabitForSoloFocus prefers the
       card's own title/insight instead, matching how SoloFocusOverlay already handles rock-* tips. */
    const recommendationTitle = isRockMorphTip
      ? headlineFromRockHabitForSoloFocus(
          String(effectiveTitleRaw),
          currentMorphData?.explanation?.[0] ?? undefined,
          focusJourney
        )
      : isLibraryWallCard
        ? headlineFromRockHabitForSoloFocus(String(effectiveTitleRaw), crawlerTip, focusJourney)
        : headlineFromExpandedHook(expandedHeadlineSource, focusJourney)
    const titleLooksEstimated = /^\s*ESTIMATED AUDIT\b/i.test(String(displayTitle ?? title ?? ''))
    const useEstimated =
      auditState === 'ESTIMATED_AUDIT' || (!auditState && titleLooksEstimated)
    const zoneCategoryLabel = formatZoneCategoryLabel(activeJourneyId)
    let sourceName = 'our partners'
    if (resolvedOfferUrl) {
      try { sourceName = new URL(resolvedOfferUrl).hostname.replace('www.', '') } catch {}
    }
    const diagnosticUrlJourney = soloHandoff.sourceLinkUrl
    const handoffAttribution = resolveSoloFocusHandoffAttribution({
      ctaUrl: soloHandoff.ctaUrl,
      researchSuppliedBy: researchAttribution?.supplied_by,
      architectSuppliedBy,
      sourceLabel: attributionSourceLabel ?? undefined,
      sourceName,
      liveScrapeSourceUrl: soloHandoff.sourceLinkUrl || undefined,
    })
    const pulseSourceUrl =
      soloHandoff.ctaUrl?.trim().startsWith('http') ? soloHandoff.ctaUrl.trim() : diagnosticUrlJourney
    const soloFocusTopLabel = formatSoloFocusTopCategoryLabel(
      zoneCategoryLabel,
      soloHandoff.ctaUrl ? handoffAttribution.offerProviderName : null
    )
    const profileTransport =
      state.profile?.transport ??
      (typeof window !== 'undefined' ? localStorage.getItem('profile_transport') : null)
    const travelFuel = state.journeyAnswers?.travel?.fuel_type ?? null
    const soloFocusCardId = activeCardId ?? cardId ?? `journey-${journeyId}`
    /**
     * Library wall cards skip the whole insight-resolution pipeline below and use their own
     * `detail` text (via `crawlerTip`) verbatim. `resolveSoloFocusInsightDisplay` has its own,
     * independent generic-content fallback (`isGenericNonLocalityLead` +
     * `buildAuditorNarrativeParagraphs`) that fires whenever the source text reads as a single,
     * concise sentence — which a library `.detail` line always is by design — discarding it for
     * the exact category-generic narrative this whole fix exists to stop, before contentMode
     * ever gets a say. Live-confirmed: "Grants up to £2,000 paid straight to your supplier..."
     * (real, correct, cited) was replaced with "In Westminster, your gas and electricity bills
     * currently hide roughly £2,000 of annual waste..." (generic, wrong action) at this exact
     * step, independent of every other fix above.
     */
    const insightDisplay = isLibraryWallCard
      ? (crawlerTip ?? '')
      : resolveExpandedTrueTipInsight({
          architectProse: verifiedArchitectProse,
          verifiedAuditMatchesJourney,
          cardId: soloFocusCardId,
          morphParts: [
            journeyId === 'home' && homeSentinelRecard && !currentMorphData ? homeSentinelRecard.description : undefined,
            currentMorphData?.description,
            geminiRecommendationCopy,
            discoveryWinLine,
            insightLabel,
            crawlerTip,
            localContextBar,
            offerOneLine,
          ],
          journeyId: focusCategoryJourneyId,
          headline: recommendationTitle,
          moneyGbp: motherMoneyTargetGbp,
          carbonKg: carbonTargetKg,
          transportBaseline: profileTransport,
          travelFuelType: travelFuel,
          userPostcode: profilePostcode ?? undefined,
          sourceDisplayName: handoffAttribution.sourceDisplayName,
          auditHeaderLocality: state.locationState?.locationName ?? undefined,
        })
    const trueTipSectionsEl = !showCardComputing ? (
      <SoloFocusProseStack
        headline={recommendationTitle}
        insightSource={insightDisplay}
        journeyId={focusCategoryJourneyId}
        moneyGbp={motherMoneyTargetGbp}
        carbonKg={carbonTargetKg}
        userPostcode={profilePostcode ?? state.profile?.postcode}
        sourceDisplayName={handoffAttribution.sourceDisplayName}
        auditHeaderLocality={state.locationState?.locationName ?? undefined}
        locality={state.locationState?.locationName ?? undefined}
        postcode={profilePostcode ?? state.profile?.postcode ?? undefined}
        contentMode={isLibraryWallCard ? 'library' : isRockMorphTip ? 'rock' : 'journey'}
        habitTitle={isRockMorphTip ? String(displayTitle || title || '').trim() : undefined}
      />
    ) : null

    const sourceFooter =
      partnerHttp
        ? ''
        : 'No live retailer link this week — figures still come from your saved audit row.'
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
    const handleCloseComplete = () => {
      setIsExiting(false)
      setMorphDeck([])
      setMorphDeckCursor(0)
      setResearchAttribution(null)
      const meta = patternShiftAfterExitRef.current
      patternShiftAfterExitRef.current = null
      if (meta) {
        onPatternShiftClose?.(meta.journeyId ?? activeJourneyId, meta)
        return
      }
      onClose?.()
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
                ...(surfaceKind === 'journey'
                  ? zoneExpandedJourneySurfaceStyleProps()
                  : surfaceVars),
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
          providerName={handoffAttribution.pulseProviderName}
          sourceUrl={pulseSourceUrl}
        />
        <div className="solo-focus-shell-wrap w-full min-w-0">
        <SoloFocusViewportUtilityStrip onClose={() => beginCloseWithPatternShift()} />

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
            <SoloFocusMotherStack
              bodyKey={motherShimmerKey}
              zoneCategoryLabel={soloFocusTopLabel}
              categoryIsNew={isUnreadCard(soloFocusCardId)}
              headline={recommendationTitle}
              showComputing={showCardComputing}
              prose={trueTipSectionsEl}
              metrics={
                <>
                  <MotherCardRenderer
                    categoryLabel=""
                    headline={null}
                    narrative={null}
                    sourceFooter={sourceFooter}
                    actionLine={
                      shouldShowSoloFocusArchitectActionLine(architectActionLine, insightDisplay)
                        ? architectActionLine
                        : null
                    }
                    moneyGbp={animatedMoneyGbp}
                    carbonKg={animatedCarbonKg}
                    estimated={useEstimated}
                    impactPulse={impactAnswerPulse}
                    ctaUrl={soloHandoff.ctaUrl}
                    ctaJourneyId={displayJourneyId as string}
                    ctaLabel={soloHandoff.ctaIsZai ? 'ASK ZAI' : journeyCtaLabel}
                    ctaSurface={currentMorphData?.high_impact ? 'yellow' : 'pink'}
                    isLiked={(state.likedCards ?? []).includes(
                      String(activeCardId || cardId || '')
                    )}
                    isDisliked={(state.dislikedCards ?? []).includes(
                      String(activeCardId || cardId || '')
                    )}
                    onLike={onLike ? handleTrinityLike : undefined}
                    onAskZai={isZaiChatEnabled() && (showAskZaiTrinity || _onAskZai) ? handleTrinityAskZai : undefined}
                    onDislike={isDislikeEnabled() ? handleTrinityDislike : undefined}
                    onCtaClick={handleTrinityCta}
                  />
                  {onNavigateJourney || onNavigateSoloFocus ? (
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
        </motion.div>
        </motion.div>
        </div>
      </ExpandedCardShell>
            </motion.div>
      <AskZaiDeepDiveSheet
        open={askZaiDeepDiveOpen}
        onClose={() => setAskZaiDeepDiveOpen(false)}
        headline={String(recommendationTitle)}
        category={zoneCategoryLabel}
        journeyKey={String(activeJourneyId)}
        cardId={String(activeCardId || cardId || '')}
        sourceUrl={pulseSourceUrl || soloHandoff.sourceLinkUrl || resolvedOfferUrl || ''}
        personalSpend={moneyValue.replace(/^£\s*/, '').trim() || '0'}
        regionalAvg={carbonValue.replace(/\s*(kg|t)\s*CO₂$/i, '').trim() || '0'}
        scrapedSource={insightLabel || crawlerTip || localContextBar || ''}
        postcode={state.profile?.postcode}
        localityName={state.locationState?.locationName ?? undefined}
        suggestedQuestions={buildDeepDiveQuestionPills(String(activeJourneyId))}
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
      {showEstimatedInsightStrip ? (
        <p className="zone-estimated-insight-strip m-0 min-w-0" aria-live="polite">
          {ZONE_ESTIMATED_INSIGHT_STRIP}
        </p>
      ) : null}
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
    </motion.div>
  )
}

