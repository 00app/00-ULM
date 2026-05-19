'use client'

/**
 * Solo Focus expanded view — same content template as JourneyBentoCard expanded (kinetic grid).
 * Tips use this overlay; journey cards use JourneyBentoCard.
 * v1.8.3: portaled to `document.body`; QUESTION ↔ RESULT (140ms), source footer, insight/RESULT asterisk lock.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
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
import type { ZoneTipCard } from '@/lib/logic/zone'
import { useApp } from '@/app/context/AppContext'
import { syncSessionState } from '@/lib/sessionStateSync'
import {
  headlineFromTitle,
  formatZoneCategoryLabel,
  MAX_EXPANDED_VIEW_HEADLINE_WORDS,
  composeScrapedInsightDescription,
  buildResearchResultsTrueTipBody,
  isRawResearchDump,
  polishTrueTipParagraphsForHeadline,
  stripExpandedCardTitleNoise,
  toThreeTrueTipParagraphs,
  wrapResultSupportingAsterisks,
  formatAuditSourceLinkDisplay,
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
import { resolveZoneSurfaceKind, zoneSurfaceStyleProps } from '@/lib/journeyColors'
import { PulseExpandedSync } from '@/app/components/PulseExpandedSync'
import { ExpandedCardShell } from '@/app/components/ExpandedCard'
import { pickPrimaryHttpUrl } from '@/lib/soloFocusDiagnosticMeta'
import { resolveSuppliedByDisplayName } from '@/lib/soloFocusSuppliedBy'
import { prioritizeMorphCardsForContext } from '@/lib/locationMorphPrioritize'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import { runSoloFocusAuditCompletionClient } from '@/lib/soloFocusAuditCompleteClient'
import { getNextMorphCard } from '@/lib/zone/getNextMorphCard'
import { getNextQuestion } from '@/lib/zone/questionHandler'
import {
  VERIFIED_SOURCE_DATE,
  formatVerifiedCitation,
  inferRevenueCtaKind,
  pickFirstHttpUrl,
  resolveRevenueCtaLabel,
} from '@/lib/zone/verifiedRevenue'
import {
  triggerScrapeSyncForCategory,
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import { resolveBirthedCardId, scheduleSoloFocusRebirthOpen } from '@/lib/soloFocusRebirth'

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
  onPatternShiftClose?: (journeyId: JourneyId) => void
  onAskZai?: () => void
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
  onAskZai,
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
}: SoloFocusOverlayProps) {
  const { setHeroTotals, state, toggleLike } = useApp()
  const profilePostcode = state.profile?.postcode ?? null
  const titleLooksEstimated = /^\s*ESTIMATED AUDIT\b/i.test(String(title ?? ''))
  const useEstimated =
    auditState === 'ESTIMATED_AUDIT' || (!auditState && titleLooksEstimated)
  const [trapComplete, setTrapComplete] = useState(() => !discoveryFollowUp)
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

  const deck = [
    {
      isOriginal: true,
      category,
      heading: recommendation,
      description: insight,
      impactMoney: null, // use fallback
      impactCarbon: null, // use fallback
      url: offerUrl,
      sourceUrl,
      sourceLabel,
      architectSuppliedBy,
      title,
      journey_key: journeyId,
      id: cardId,
    },
    ...morphedCardsQueue,
  ]
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
  const zoneCategoryLabel = formatZoneCategoryLabel(String(displayJourneyId ?? journeyId ?? 'home'))

  const activeCardId = currentMorphData?.id ?? cardId

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
  const covLookupKey = String(displayJourneyId ?? journeyId ?? '')
    .trim()
    .toLowerCase()
  const journeyResearchCov =
    covLookupKey && researchCategoryCoverage ? researchCategoryCoverage[covLookupKey] : undefined
  const overlayResearchSettled = journeyResearchSettled(journeyResearchCov)
  const covOfferHttp =
    journeyResearchCov?.latestOfferUrl?.trim().startsWith('http')
      ? journeyResearchCov.latestOfferUrl.trim()
      : ''
  const covSourceHttp =
    journeyResearchCov?.latestSourceUrl?.trim().startsWith('http')
      ? journeyResearchCov.latestSourceUrl.trim()
      : ''
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
  const allowZaiFallback =
    researchCategoryCoverage === undefined || researchCategoryCoverage === null
      ? true
      : journeyResearchCov == null
  const soloHandoff = resolveSoloFocusHandoffUrls({
    coverageOfferUrl: journeyResearchCov?.latestOfferUrl,
    coverageSourceUrl: journeyResearchCov?.latestSourceUrl,
    fallbackOfferUrl: pickPrimaryHttpUrl(offerUrl, liveDiscoveryUrl, partnerHttp),
    fallbackSourceUrl: pickPrimaryHttpUrl(sourceUrl, covSourceHttp),
    buildZaiUrl: () => (allowZaiFallback ? buildZaiAuditUrl() : ''),
  })
  const resolvedOpenUrl = soloHandoff.ctaUrl.trim()

  /** ✓ True data — Neon `research_results.verified` (via scrape-sync coverage). */
  const dbVerifiedFromResearchTable =
    researchCategoryCoverage != null && covLookupKey
      ? journeyResearchCov?.verified === true
      : null

  const effectiveTitleRaw =
    discoveryRebirthTip && rebirthDiscoveryTitle?.trim()
      ? rebirthDiscoveryTitle.trim()
      : currentMorphData
        ? String(displayTitle || displayRecommendation).trim() || displayRecommendation
        : researchAttribution?.headline?.trim() ||
          String(displayTitle || displayRecommendation || title).trim() ||
          displayRecommendation
  const isZoneMotherChild = !startInQuestionMode
  const recommendationTitle = headlineFromTitle(
    stripExpandedCardTitleNoise(String(effectiveTitleRaw)),
    MAX_EXPANDED_VIEW_HEADLINE_WORDS
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
  const diagnosticProvider = resolveSuppliedByDisplayName({
    researchSuppliedBy: researchAttribution?.supplied_by,
    architectSuppliedBy,
    sourceLabel,
    sourceName,
    liveScrapeSourceUrl: soloHandoff.sourceLinkUrl || undefined,
  })
  const diagnosticUrl = soloHandoff.sourceLinkUrl
  const researchBackedTrueTip =
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
    scrapedOverlay && !genericCopy.test(scrapedOverlay)
      ? scrapedOverlay
      : resolvedOpenUrl.trim() && sourceName
        ? `${sourceName} carries the tariff notes, eligibility copy, and programme detail behind this headline. Use the link to read the authoritative wording on site before acting.`
        : scrapedOverlay
  const insightParaSource =
    researchBackedTrueTip?.trim() ??
    (preSplitAuditor.length >= 3
      ? preSplitAuditor.slice(0, 3).join('\n\n')
      : (insightDisplay || '').trim() || rawInsight)
  const trueTipParagraphs = polishTrueTipParagraphsForHeadline(
    recommendationTitle,
    toThreeTrueTipParagraphs(insightParaSource)
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
            <motion.p
              key={`architect-p-${i}`}
              className="solo-focus-architect-prose solo-focus-copy-width solo-focus-content-text text-left m-0"
              style={{ color: 'var(--journey-text)' }}
              variants={FADE_VARIANTS}
            >
              {para}
            </motion.p>
          ) : null
        )}
        {verifiedSourceLinkEl}
      </div>
    ) : null
  const sourceFooter = partnerHttp
    ? ''
    : 'Fresh Audit: live partner offer unavailable, running verified fallback.'
  const overlayCtaKind = inferRevenueCtaKind({
    journey: (journeyId ?? 'home') as JourneyId,
    actionType: tipNeedsSwitching
      ? 'switch'
      : String(currentMorphData?.actions?.actionType || 'learn').toLowerCase(),
    needsSwitching: tipNeedsSwitching,
    isPriorityHome: Boolean(isPriorityHome),
  })
  const effectiveHandoffLabel = ctaLabel ?? resolveRevenueCtaLabel(overlayCtaKind, motherMoneyTargetGbp)
  const verifiedOverlayCitation = formatVerifiedCitation(
    (verifiedSourceName ?? diagnosticProvider).trim(),
    (verifiedSourceDate ?? VERIFIED_SOURCE_DATE).trim()
  )

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
    setTrapComplete(!discoveryFollowUp)
  }, [discoveryFollowUp])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!journeyId || !onJourneyAnswered) return
    if (viewState === 'QUESTION') return
    try {
      const raw = localStorage.getItem(`journey_${journeyId}_answers`) || '{}'
      const parsed = JSON.parse(raw) as Record<string, string>
      const hasPendingQuestion = getNextQuestion(journeyId, parsed) != null
      if (hasPendingQuestion) {
        persistViewState('QUESTION')
      }
    } catch {
      /* ignore storage parse errors */
    }
  }, [journeyId, onJourneyAnswered, viewState, persistViewState])

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

  const loopJourneyKey = (displayJourneyId ?? journeyId ?? normalizeCategoryToJourneyKey(category)) as JourneyId

  const requestClose = useCallback(() => {
    triggerHaptic('medium')
    onPatternShiftClose?.(loopJourneyKey)
    onClose()
  }, [loopJourneyKey, onPatternShiftClose, onClose])

  const handleTrinityLike = useCallback(() => {
    triggerHaptic('medium')
    const id = String(activeCardId || cardId || '')
    if (!id) return
    const likeFn = onLike ?? toggleLike
    likeFn(id, displayTitle, parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)))
  }, [activeCardId, cardId, onLike, toggleLike, displayTitle, displayMoneyValue])

  const handleTrinityAskZai = useCallback(() => {
    triggerHaptic('medium')
    setAskZaiDeepDiveOpen(true)
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
  const overlaySurfaceVars = zoneSurfaceStyleProps(overlaySurfaceKind)

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
      <PulseExpandedSync providerName={diagnosticProvider} sourceUrl={diagnosticUrl} />
        <motion.div
          className={`solo-focus-stack solo-focus-rail flex flex-col justify-start w-full items-center min-w-[280px] max-w-[800px] md:w-[90%] lg:w-[800px] ${isZoneMotherChild ? 'px-4 sm:px-0' : ''}`}
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
                className="solo-focus-shell solo-focus-mother solo-focus-content-stack w-full min-w-0 rounded-[60px] p-[40px] relative"
              >
            <div className="solo-focus-expanded-toolbar solo-focus-mother-columns w-full min-w-0">
              <div className="solo-focus-mother-copy flex-1 min-w-0 flex flex-col items-stretch w-full min-w-0">
                <div className="flex flex-col gap-0 w-full min-w-0">
                {resolvedOpenUrl.trim() ? (
                  <motion.div
                    className="solo-focus-insight-bridge w-full min-w-0"
                    variants={FADE_VARIANTS}
                    onClick={() => triggerHaptic('light')}
                  >
                    <span
                      className="card-top-label solo-focus-zone-category m-0 text-left w-full block"
                      style={{ color: 'var(--journey-text)' }}
                    >
                      {zoneCategoryLabel}
                    </span>
                    <motion.h1
                      className="solo-focus-architect-headline solo-focus-content-text text-left zz-shimmer-focus"
                      style={{
                        color: 'var(--journey-text)',
                        margin: 0,
                        padding: 0,
                      }}
                      initial={reducePagerMotion ? false : SHIMMER_FOCUS.initial}
                      animate={reducePagerMotion ? { opacity: 1 } : SHIMMER_FOCUS.animate}
                      transition={SHIMMER_FOCUS.transition}
                    >
                      {recommendationTitle}
                    </motion.h1>
                    {trueTipSectionsEl}
                  </motion.div>
                ) : (
                  <>
                    {!resolvedOpenUrl.trim() && researchCategoryCoverage != null && !overlayResearchSettled ? (
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
                    <motion.h1
                      className="solo-focus-architect-headline solo-focus-content-text text-left zz-shimmer-focus"
                      style={{
                        color: 'var(--journey-text)',
                        margin: 0,
                        padding: 0,
                      }}
                      initial={reducePagerMotion ? false : SHIMMER_FOCUS.initial}
                      animate={reducePagerMotion ? { opacity: 1 } : SHIMMER_FOCUS.animate}
                      transition={SHIMMER_FOCUS.transition}
                    >
                      {recommendationTitle}
                    </motion.h1>
                    {trueTipSectionsEl}
                  </>
                )}

                <MotherCardRenderer
                  categoryLabel=""
                  headline={null}
                  narrative={null}
                  sourceFooter={sourceFooter}
                  verifiedSourceCitation={verifiedOverlayCitation}
                  verifiedDataBadge={Boolean(dbVerifiedFromResearchTable)}
                  moneyGbp={animatedMoneyGbp}
                  carbonKg={animatedCarbonKg}
                  impactPulse={impactAnswerPulse}
                  ctaUrl={soloHandoff.ctaUrl}
                  ctaJourneyId={journeyId}
                  ctaLabel={soloHandoff.ctaIsZai ? 'ASK ZAI' : effectiveHandoffLabel}
                  isLiked={isLiked}
                  onLike={handleTrinityLike}
                  onAskZai={handleTrinityAskZai}
                />
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
                  onClick={requestClose}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={INDUSTRIAL_OPACITY_SNAP}
                  style={{ transformOrigin: 'top right' }}
                >
                  <BackArrowDownLeft size={24} />
                </motion.button>
              </div>
            </div>
              </motion.div>
          </>
          )}

        </motion.div>
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
        suggestedQuestions={[
          'Why this shift saves money',
          'What is the carbon trade-off',
          'What is the next concrete step',
        ]}
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
