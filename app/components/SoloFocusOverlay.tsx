'use client'

/**
 * Solo Focus expanded view — same content template as JourneyBentoCard expanded (kinetic grid).
 * Tips / filler use this overlay; journey cards use JourneyBentoCard + shared layoutId where applicable.
 * §18.5: portaled to `document.body`; v1.8.3: QUESTION ↔ RESULT (140ms), source footer, insight/RESULT asterisk lock.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { type JourneyId, getOptionFullLabel } from '@/lib/journeys'
import { formatMoneyImpact, formatCarbonImpact, formatZoneCardMoney } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { buildSoloFocusAskZaiQuestion, setAskZaiContext } from '@/lib/expandStorage'
import {
  ELASTIC_PING,
  INTRO_FADE_UP_NO_DELAY,
  FADE_VARIANTS,
  SPRING_TAP,
  SPRING_BLOOM,
  soloFocusSlamMotionProps,
  SLAM_SPRING,
} from '@/lib/animations'
import { useCountUp } from '@/lib/utils/useCountUp'
import {
  parseMoneyGbpFromImpactDisplay,
  parseCarbonKgFromImpactDisplay,
} from '@/lib/soloFocusImpactParse'
import { EmbeddedJourneyQuestion } from '@/app/components/EmbeddedJourneyQuestion'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import type { ZoneTipCard } from '@/lib/zone/buildZoneViewModel'
import { useApp } from '@/app/context/AppContext'
import { syncSessionState } from '@/lib/sessionStateSync'
import {
  headlineFromTitle,
  composeScrapedInsightDescription,
  wrapResultSupportingAsterisks,
} from '@/lib/soloFocusCopy'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { estimateDiscoveryCarbonKg, ukAverageSavingForDiscoveryAnswer } from '@/lib/brains/calculations'
import { injectNewDiscoveryCard } from '@/lib/discoveryInject'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import {
  PRICE_CAP_APRIL_2026,
  PRICE_CAP_MARCH_2026,
  PRICE_CAP_SAVING_APRIL_1,
} from '@/lib/brains/constants'
import { isScottishPostcodeArea, regionalHeatPumpGrantGbp } from '@/lib/zone/regionalGrants'
import { normalizeCategoryToJourneyKey, trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import {
  getJourneyCardTextHex,
  getJourneyCtaBgHex,
  getJourneyCtaTextHex,
  getSystemCtaBgHex,
  getSystemCtaTextHex,
} from '@/lib/journeyColors'
import { PulseExpandedSync } from '@/app/components/PulseExpandedSync'
import { pickPrimaryHttpUrl, fallbackDiagnosticUrl } from '@/lib/soloFocusDiagnosticMeta'
import { resolveSuppliedByDisplayName } from '@/lib/soloFocusSuppliedBy'
import { locationInPhrase } from '@/lib/locationIdentity'
import { prioritizeMorphCardsForContext } from '@/lib/locationMorphPrioritize'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import { getNextMorphCard } from '@/lib/zone/getNextMorphCard'

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
}

function triggerHaptic(p: 'light' | 'medium' | 'heavy') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    if (p === 'heavy') navigator.vibrate(25)
    else if (p === 'medium') navigator.vibrate(15)
    else navigator.vibrate(5)
  }
}

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

function trimToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  return `${words.slice(0, maxWords).join(' ')}...`
}

const WORD_CYCLE_STAGGER_S = 0.12

function renderWordCycle(text: string, keyPrefix: string) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return (
    <motion.span
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: WORD_CYCLE_STAGGER_S,
          },
        },
      }}
      style={{ display: 'inline' }}
    >
      {words.map((word, idx) => (
        <motion.span
          key={`${keyPrefix}-${idx}-${word}`}
          variants={{
            hidden: { opacity: 0, y: 6 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: WORD_CYCLE_STAGGER_S, ease: [0.22, 1, 0.36, 1] },
            },
          }}
          style={{ display: 'inline-block', marginRight: idx === words.length - 1 ? 0 : '0.32ch' }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  )
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
}: SoloFocusOverlayProps) {
  const { setHeroTotals, state, toggleLike } = useApp()
  const profilePostcode = state.profile?.postcode ?? null
  const locationPhrase = locationInPhrase(state.locationState?.locationName ?? '')
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
  const [isGlitchingMoney, setIsGlitchingMoney] = useState(false)
  const [glitchDisplayGbp, setGlitchDisplayGbp] = useState(0)
  const [questionCount, setQuestionCount] = useState(0)

  useEffect(() => {
    if (!isGlitchingMoney) return
    const interval = setInterval(() => setGlitchDisplayGbp(Math.floor(Math.random() * 9999)), 50)
    return () => clearInterval(interval)
  }, [isGlitchingMoney])

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

  const resolvedOpenUrl =
    [
      liveClaimUrl,
      morphLearnResolved,
      resultCitation?.url,
      offerUrl,
      sourceUrl,
      discoveryRecUrl,
    ].find((u) => typeof u === 'string' && u.trim().length > 0)?.trim() ?? ''

  const effectiveTitleRaw = currentMorphData
    ? String(displayTitle || displayRecommendation).trim() || displayRecommendation
    : researchAttribution?.headline?.trim() ||
      String(displayTitle || displayRecommendation || title).trim() ||
      displayRecommendation
  const isZoneMotherChild = !startInQuestionMode
  const isWickHome = Boolean(
    String(displayJourneyId ?? journeyId ?? '').toLowerCase() === 'home' &&
    profilePostcode?.toUpperCase().startsWith('KW')
  )
  const recommendationTitle = (
    isWickHome ? '£9,000 RURAL HEAT GRANT' : headlineFromTitle(effectiveTitleRaw)
  ).toUpperCase()
  let sourceName = sourceLabel
  if (!sourceName && resolvedOpenUrl) {
    try { sourceName = new URL(resolvedOpenUrl).hostname.replace('www.', '') } catch {}
  }
  sourceName = sourceName || 'our partners'
  const diagnosticProvider = resolveSuppliedByDisplayName({
    researchSuppliedBy: researchAttribution?.supplied_by,
    architectSuppliedBy,
    sourceLabel,
    sourceName,
    liveScrapeSourceUrl: pickPrimaryHttpUrl(resolvedOpenUrl, sourceUrl, offerUrl) ?? undefined,
  })
  const diagnosticUrl =
    pickPrimaryHttpUrl(resolvedOpenUrl, sourceUrl, offerUrl) ||
    fallbackDiagnosticUrl((displayJourneyId as JourneyId | undefined) ?? journeyId ?? null)
  const scrapedOverlay = composeScrapedInsightDescription([displayInsight ?? insight], 3).trim()
  const genericCopy = /answer a few questions|personalise your/i
  const insightDisplay =
    scrapedOverlay && !genericCopy.test(scrapedOverlay)
      ? scrapedOverlay
      : resolvedOpenUrl.trim() && sourceName
        ? `${sourceName} carries the tariff notes, eligibility copy, and programme detail behind this headline. Use the link to read the authoritative wording on site before acting.`
        : scrapedOverlay
  const insightParagraphs = (() => {
    const base = (insightDisplay || '').trim()
    if (!base) return [] as string[]
    const chunks = base
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (chunks.length <= 2) return chunks.map((chunk) => trimToWords(chunk, 11))
    return [
      trimToWords(chunks.slice(0, Math.ceil(chunks.length / 2)).join(' '), 11),
      trimToWords(chunks.slice(Math.ceil(chunks.length / 2)).join(' '), 11),
    ]
  })()

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
    if (viewState !== 'RESULT' || !discoverySnap) {
      setImpactAnswerPulse(false)
      return
    }
    setImpactAnswerPulse(true)
    const t = window.setTimeout(() => setImpactAnswerPulse(false), 720)
    return () => clearTimeout(t)
  }, [viewState, discoverySnap, discoverySnap?.questionId, discoverySnap?.answerValue])

  const handleClose = useCallback(() => {
    triggerHaptic('medium')
    setResultCitation(null)
    setLiveClaimUrl(null)
    setDiscoverySnap(null)
    setGeminiRecommendationCopy(null)
    setDiscoveryWinLine(null)
    setBirthedZoneTitle(null)
    setGridContext(null)
    setViewState('QUESTION')
    setMorphedCardsQueue([]) // clear queue on close
    setActiveSiblingIndex(0) // reset index
    setResearchAttribution(null)
    setSoloEmbedQuestionLabel(null)
    setLoopZipCollapsing(false)
    setQuestionCount(0)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(sfStorageKey)
      } catch {
        // ignore
      }
    }
    onClose()
  }, [onClose, sfStorageKey])

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

  const surfaceJid = (displayJourneyId ?? journeyId) as JourneyId | undefined
  const overlayJourneyBg = isZoneMotherChild ? ('#F0FF00' as const) : (surfaceJid != null ? (`var(--color-j-${surfaceJid})` as const) : ('var(--color-purple)' as const))
  const overlayJourneyText =
    isZoneMotherChild ? ('var(--color-purple)' as const) : (surfaceJid != null ? getJourneyCardTextHex(surfaceJid) : ('var(--color-yellow)' as const))
  const overlayCtaBg = isZoneMotherChild
    ? 'var(--color-purple)'
    : surfaceJid != null
      ? getJourneyCtaBgHex(surfaceJid)
      : getSystemCtaBgHex()
  const overlayCtaText = isZoneMotherChild
    ? 'var(--color-yellow)'
    : surfaceJid != null
      ? getJourneyCtaTextHex(surfaceJid)
      : getSystemCtaTextHex()

  const overlay = (
    <AnimatePresence mode="wait">
      <motion.div key={activeCardId} className="solo-focus-grow-layer" initial={false}>
      <motion.div
        layout
        className="expanded-solo-focus view-expanded solo-focus-mobile-expand"
        data-journey={displayJourneyId ?? 'overlay'}
        {...(isZoneMotherChild ? { 'data-sf-yellow-slab': 'true' } : {})}
        style={
          {
            ['--journey-bg' as string]: overlayJourneyBg,
            ['--journey-text' as string]: overlayJourneyText,
            ['--color-ink' as string]: overlayJourneyText,
            ['--journey-accent' as string]: overlayCtaBg,
            ['--journey-on-accent' as string]: overlayCtaText,
            ['--journey-cta-bg' as string]: overlayCtaBg,
            ['--journey-cta-text' as string]: overlayCtaText,
            ...(currentMorphData ? { transformOrigin: '50% 50%' } : {}),
          } as React.CSSProperties
        }
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 550, damping: 32, mass: 1 }}
      >
      <PulseExpandedSync providerName={diagnosticProvider} sourceUrl={diagnosticUrl} />
      <motion.div layout className="solo-focus-body-scroll w-full min-w-0">
        <motion.div
          layout
          className={`solo-focus-stack solo-focus-rail flex flex-col justify-start w-full items-center min-w-[280px] max-w-[800px] md:w-[90%] lg:w-[800px] ${isZoneMotherChild ? 'px-4 sm:px-0' : ''}`}
        >
          {/* Card A: The Mother */}
          {isZoneMotherChild && (
          <AnimatePresence mode="wait">
              <motion.div
                key={`overlay-hero-${activeSiblingIndex}-${String(activeCardId ?? 'base')}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: isGlitchingMoney ? 1.05 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 550, damping: 35 }}
                style={{ transformOrigin: 'top center', willChange: 'transform', backgroundColor: '#F0FF00' }}
                className="solo-focus-shell solo-focus-mother solo-focus-content-stack w-full min-w-0 rounded-[60px] p-[40px] relative"
              >
            {isZoneMotherChild && (
              <>
            <div className="solo-focus-expanded-toolbar solo-focus-mother-columns w-full min-w-0">
              <div className="solo-focus-mother-copy flex-1 min-w-0 flex flex-col items-stretch w-full min-w-0">
                <div className="flex flex-col gap-2 w-full min-w-0">
                  <motion.h5
                    layout
                    className="solo-focus-category zz-label m-0 text-left"
                    style={{ color: 'var(--journey-text)', fontSize: 'var(--zz-h4-mobile)', lineHeight: 0.8 }}
                    initial={INTRO_FADE_UP_NO_DELAY.initial}
                    animate={INTRO_FADE_UP_NO_DELAY.animate}
                    transition={{ ...INTRO_FADE_UP_NO_DELAY.transition, delay: 0.05 }}
                  >
                    {displayCategory.toUpperCase().replace(/-/g, ' ')}
                  </motion.h5>
                {resolvedOpenUrl.trim() ? (
                  <motion.a
                    href={resolvedOpenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="solo-focus-insight-bridge w-full min-w-0"
                    variants={FADE_VARIANTS}
                    onClick={() => triggerHaptic('light')}
                  >
                    <motion.h3
                      className="solo-focus-recommendation-headline solo-focus-content-text text-marvin uppercase text-left zz-h3"
                      style={{
                        fontFamily: 'var(--font-marvin)',
                        fontWeight: 700,
                        lineHeight: 0.8,
                        color: 'var(--journey-text)',
                        margin: 0,
                        padding: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {renderWordCycle(trimToWords(recommendationTitle, 11), 'mother-heading-link')}
                    </motion.h3>
                    {insightParagraphs.map((paragraph, idx) => (
                      <motion.p
                        key={`insight-a-${idx}`}
                        className="solo-focus-insight solo-focus-description solo-focus-scraped-tip solo-focus-copy-width solo-focus-content-text text-left"
                        style={{
                          color: 'var(--journey-text)',
                          margin: 0,
                        }}
                        variants={FADE_VARIANTS}
                      >
                        {renderWordCycle(paragraph, `mother-insight-link-${idx}`)}
                      </motion.p>
                    ))}
                  </motion.a>
                ) : (
                  <>
                    <motion.h3
                      className="solo-focus-recommendation-headline solo-focus-content-text text-marvin uppercase text-left zz-h3"
                      style={{
                        fontFamily: 'var(--font-marvin)',
                        fontWeight: 700,
                        lineHeight: 0.8,
                        color: 'var(--journey-text)',
                        margin: 0,
                        padding: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {renderWordCycle(trimToWords(recommendationTitle, 11), 'mother-heading-static')}
                    </motion.h3>
                    {insightParagraphs.map((paragraph, idx) => (
                      <motion.p
                        key={`insight-b-${idx}`}
                        className="solo-focus-insight solo-focus-description solo-focus-scraped-tip solo-focus-copy-width solo-focus-content-text text-left"
                        style={{ color: 'var(--journey-text)', margin: 0 }}
                        variants={FADE_VARIANTS}
                      >
                        {renderWordCycle(paragraph, `mother-insight-static-${idx}`)}
                      </motion.p>
                    ))}
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
                  Supplied by {diagnosticProvider}
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
                      <StampedMoneyGbp gbp={isGlitchingMoney ? glitchDisplayGbp : animatedMoneyGbp} />
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
                  onClick={handleClose}
                  whileTap={{ scale: 0.96 }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ transformOrigin: 'top right' }}
                >
                  <BackArrowDownLeft size={24} />
                </motion.button>
                {((activeCardId || cardId) || onAskZai) ? (
                  <motion.div
                    className="solo-focus-utility-row flex flex-col items-end justify-start shrink-0"
                    style={{ gap: 20 }}
                    variants={FADE_VARIANTS}
                  >
                    {(activeCardId || cardId) && (
                      <motion.button
                        type="button"
                        className="circle-btn solo-focus-action-btn solo-focus-action-80"
                        onClick={() => {
                          triggerHaptic('medium')
                          const id = String(activeCardId || cardId)
                          const likeFn = onLike ?? toggleLike
                          likeFn(id, displayTitle, parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)))
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
                          const trapQuestion = !trapComplete && discoveryFollowUp?.question?.trim() ? discoveryFollowUp.question.trim() : ''
                          const zaiLabel = soloEmbedQuestionLabel?.trim() || trapQuestion || null
                          setAskZaiContext({
                            category: displayCategory,
                            personalSpend: String(displayMoneyValue).replace(/^£\s*/, '').trim() || '0',
                            regionalAvg: String(displayCarbonValue).replace(/\s*(kg|t)\s*CO₂$/i, '').trim() || '0',
                            question: buildSoloFocusAskZaiQuestion(displayTitle, zaiLabel),
                            journey_question_label: zaiLabel,
                            userContext: userContextSnap,
                            scraped_source: sourceLabel || sourceUrl || '',
                            journey_answers_jsonb: allAnswers
                          })
                          handleClose()
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
                  {resolvedOpenUrl.trim() && (
                    <IndustrialHandoffButton
                      url={profilePostcode?.toUpperCase().startsWith('KW') && journeyId === 'home' ? 'https://www.homeenergyscotland.org/' : resolvedOpenUrl.trim()}
                      journeyId={journeyId}
                      moneyValue={parseMoneyGbpFromImpactDisplay(String(displayMoneyValue))}
                      ctaLabel="CLAIM"
                    />
                  )}
                </motion.div>
              </>
            )}
                {deck.length > 1 && (
                  <div className="flex flex-row items-center justify-center gap-3 w-full mt-8">
                    {deck.map((_, idx) => (
                      <motion.button
                        key={idx}
                        type="button"
                        onClick={() => setActiveSiblingIndex(idx)}
                        className="rounded-full border-none cursor-pointer"
                        style={{ backgroundColor: 'var(--journey-text)' }}
                        animate={{
                          width: activeSiblingIndex === idx ? 14 : 10,
                          height: activeSiblingIndex === idx ? 14 : 10,
                          opacity: activeSiblingIndex === idx ? 1 : 0.4,
                        }}
                        transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.5 }}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
          </AnimatePresence>
          )}

          {/* Card B: The Gate */}
          <motion.div
            className="solo-focus-shell solo-focus-child w-full flex flex-col items-start rounded-[60px] p-[40px]"
            style={{ backgroundColor: '#F0FF00', transformOrigin: 'top center', willChange: 'transform' }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 550, damping: 35 }}
          >
            {discoveryFollowUp && !trapComplete ? (
              <motion.div
                className="solo-focus-loop trinity-to-question flex-shrink-0 w-full flex flex-col items-start view-expanded solo-focus-trap-block gap-4 pt-0"
                variants={FADE_VARIANTS}
                initial={INTRO_FADE_UP_NO_DELAY.initial}
                animate={INTRO_FADE_UP_NO_DELAY.animate}
                transition={INTRO_FADE_UP_NO_DELAY.transition}
              >
              <h4
                className="solo-focus-question-label solo-focus-copy-width text-marvin text-left uppercase m-0"
                style={{
                  fontFamily: 'var(--font-marvin)',
                  fontWeight: 700,
                  fontSize: '30px',
                  color: 'var(--sf-prose-contrast)',
                }}
              >
                {discoveryFollowUp.question}
              </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16, rowGap: 16, justifyContent: 'flex-start', maxWidth: '100%' }}>
                  {discoveryFollowUp.options.map((opt) => {
                    const isDense = discoveryFollowUp.options.length > 6
                    const circleClass = isDense ? 'answer-circle-80' : 'answer-circle-100'
                    const circleStyle = isDense ? { width: 80, height: 80, fontSize: 16 } : {}
                    return (
                    <motion.button
                      key={opt}
                      type="button"
                      className={`solo-focus-answer-option ${circleClass} circle-btn`}
                      onClick={() => {
                      triggerHaptic('medium')
                      const j = journeyId ?? 'home'
                      setLoopZipCollapsing(true)
                      void (async () => {
                        try {
                          const res = await fetch('/api/answers', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              journey_key: j,
                              question_key: discoveryFollowUp.targetField,
                              answer_value: opt,
                            }),
                          })
                          const data = res.ok ? await res.json().catch(() => null) : null

                          // 3. Gemini "Birth" Logic
                          fetch('/api/zone/injections', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              journey_key: j,
                              question_key: discoveryFollowUp.targetField,
                              answer_value: opt,
                            }),
                          })
                            .then(r => r.json())
                            .then(injectData => {
                              const zoneCard = injectData?.discovery?.new_card_data
                              if (zoneCard && typeof zoneCard === 'object' && 'id' in zoneCard) {
                                injectNewDiscoveryCard(zoneCard)
                              }
                            })
                            .catch(() => {})

                          if (
                            data?.newTotals &&
                            typeof data.newTotals.totalMoney === 'number' &&
                            typeof data.newTotals.totalCarbon === 'number'
                          ) {
                            setHeroTotalsOverride({
                              money: Math.max(0, Math.round(data.newTotals.totalMoney)),
                              carbon: Math.max(0, Math.round(data.newTotals.totalCarbon)),
                            })
                            setIsGlitchingMoney(true)
                            setTimeout(() => setIsGlitchingMoney(false), 500)
                            setHeroTotals({
                              totalMoney: data.newTotals.totalMoney,
                              totalCarbon: data.newTotals.totalCarbon,
                            })
                          }
                          const cite = data?.sourceCitation as { label?: string; url?: string } | undefined
                          if (cite && typeof cite.label === 'string' && cite.label.trim()) {
                            setResultCitation({
                              label: cite.label.trim(),
                              url: typeof cite.url === 'string' ? cite.url : undefined,
                            })
                          }
                          const disc = data?.discovery as { source_url?: string } | undefined
                          if (typeof disc?.source_url === 'string' && disc.source_url.startsWith('http')) {
                            setResultCitation((prev) => prev ?? { label: 'recommended link', url: disc.source_url })
                          }
                          if (typeof window !== 'undefined') {
                            try {
                              window.localStorage.setItem(`discovery_trap_${discoveryFollowUp.targetField}`, opt)
                              const sk = `journey_${j}_answers`
                              const prev = JSON.parse(window.localStorage.getItem(sk) || '{}') as Record<string, string>
                              window.localStorage.setItem(sk, JSON.stringify({ ...prev, [discoveryFollowUp.targetField]: opt }))
                              persistUnifiedUserProfileMemory()
                            } catch {
                              /* ignore */
                            }
                          }
                        } catch {
                          /* ignore network errors */
                        }
                        syncSessionState()
                        setTrapComplete(true)
                        setLoopZipCollapsing(false)
                        onDiscoveryTrapComplete?.()
                      })()
                    }}
                    style={circleStyle}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING_TAP}
                  >
                    {getOptionFullLabel(opt).replace(/\s+/g, '').slice(0, 7).toUpperCase()}
                  </motion.button>
                  )
                })}
              </div>
            </motion.div>
          ) : null}

          {journeyId && onJourneyAnswered && (trapComplete || !discoveryFollowUp) ? (
            <motion.div
              className={`solo-focus-loop trinity-to-question flex-shrink-0 w-full flex flex-col items-start view-expanded solo-focus-trap-block${loopZipCollapsing ? ' solo-focus-loop--posting' : ''}`}
              variants={FADE_VARIANTS}
            >
              <AnimatePresence mode="wait">
                {viewState === 'RESULT' ? (
                  <motion.div
                    key={`overlay-sf-result-${discoverySnap?.questionId ?? 'q'}-${String(discoverySnap?.answerValue ?? '').slice(0, 24)}-${currentMorphData?.id ?? activeCardId ?? 'base'}`}
                    {...soloFocusSlamMotionProps(reducePagerMotion, false)}
                    className="flex flex-col items-start w-full gap-6"
                    style={{ transformOrigin: '50% 50%' }}
                  >
                    <h4
                      className="solo-focus-question-label solo-focus-copy-width text-marvin text-left uppercase m-0"
                      style={{
                        fontFamily: 'var(--font-marvin)',
                        fontWeight: 700,
                        fontSize: '30px',
                        color: 'var(--sf-prose-contrast)',
                      }}
                    >
                      How we calculated this
                    </h4>
                    {journeyId === 'home' ? (
                      <p
                        className="zz-body-bold solo-focus-copy-width text-left m-0"
                        style={{
                          color: 'var(--journey-text)',
                          fontFamily: 'var(--font-roboto)',
                          fontWeight: 800,
                        }}
                      >
                        Save £{PRICE_CAP_SAVING_APRIL_1} on 1 April — typical cap {formatZoneCardMoney(PRICE_CAP_MARCH_2026)}/yr →{' '}
                        {formatZoneCardMoney(PRICE_CAP_APRIL_2026)}/yr.
                      </p>
                    ) : null}
                    {birthedZoneTitle ? (
                      <p
                        className="zz-body-bold solo-focus-copy-width text-left m-0"
                        style={{
                          color: 'var(--journey-text)',
                          fontFamily: 'var(--font-marvin)',
                          fontWeight: 700,
                        }}
                      >
                        {wrapResultSupportingAsterisks(`We found a new win! ${birthedZoneTitle} is now in your Zone.`)}
                      </p>
                    ) : null}
                    {gridContext?.cleaner_vs_2025_pct != null ? (
                      <p
                        className="zz-body-bold solo-focus-copy-width text-left m-0"
                        style={{ color: 'var(--journey-text)', fontFamily: 'var(--font-roboto)', fontWeight: 800 }}
                      >
                        {wrapResultSupportingAsterisks(
                          `Grid is ${gridContext.cleaner_vs_2025_pct}% cleaner than 2025. Your win just got bigger.`
                        )}
                      </p>
                    ) : null}
                    {discovery ? (
                      <>
                        {discoveryWinLine ? (
                          <p
                            className="zz-body-bold solo-focus-copy-width text-left m-0"
                            style={{
                              color: 'var(--journey-text)',
                              fontFamily: 'var(--font-roboto)',
                              fontWeight: 800,
                            }}
                          >
                            {wrapResultSupportingAsterisks(discoveryWinLine)}
                          </p>
                        ) : geminiRecommendationCopy ? (
                          <p
                            className="zz-body-bold solo-focus-copy-width text-left m-0"
                            style={{
                              color: 'var(--journey-text)',
                              fontFamily: 'var(--font-roboto)',
                              fontWeight: 800,
                            }}
                          >
                            {wrapResultSupportingAsterisks(geminiRecommendationCopy)}
                          </p>
                        ) : null}
                        <p className="zz-body-bold solo-focus-copy-width text-left m-0" style={{ color: 'var(--journey-text)' }}>
                          {wrapResultSupportingAsterisks(
                            `UK average saving for ${discovery.sav.answerLabel} is £${formatMoneyImpact(Math.round(discovery.sav.gbp))}.`
                          )}
                        </p>
                        {discoveryImpactKg > 0 ? (
                          <>
                            <p
                              className="zz-body-bold solo-focus-copy-width text-left m-0"
                              style={{
                                color: 'var(--journey-text)',
                                fontFamily: 'var(--font-roboto)',
                                fontWeight: 800,
                              }}
                            >
                              {wrapResultSupportingAsterisks(
                                `IMPACT: −${
                                  discoveryImpactKg >= 1000
                                    ? `${(discoveryImpactKg / 1000).toFixed(1)}T`
                                    : `${Math.round(discoveryImpactKg)} kg`
                                } CO₂e`
                              )}
                            </p>
                            <p className="zz-body solo-focus-copy-width text-left m-0 opacity-95" style={{ color: 'var(--journey-text)' }}>
                              {wrapResultSupportingAsterisks(
                                `That is the equivalent of planting ${treeEquivalent} trees this year.`
                              )}
                            </p>
                          </>
                        ) : null}
                        <p className="zz-body-bold solo-focus-copy-width text-left m-0" style={{ color: 'var(--journey-text)' }}>
                          {wrapResultSupportingAsterisks(
                            `${discovery.rec.headline.replace(/_/g, ' ')} — ${discovery.rec.body}`
                          )}
                        </p>
                        <p className="zz-body solo-focus-copy-width text-left m-0 opacity-95" style={{ color: 'var(--journey-text)' }}>
                          {wrapResultSupportingAsterisks(
                            `You’re on track — save £${formatMoneyImpact(moneyValue)} and ${formatCarbonImpact(carbonValue).value} ${formatCarbonImpact(carbonValue).unit} from this journey.`
                          )}
                        </p>
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
                      Tap the close control to return to your zone.
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
                    key="overlay-solo-focus-question-wrap"
                    className="w-full flex flex-col items-start"
                    {...soloFocusSlamMotionProps(reducePagerMotion, false)}
                    style={{ transformOrigin: '50% 50%' }}
                  >
                    <EmbeddedJourneyQuestion
                      journeyId={journeyId}
                      onClose={handleClose}
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
                    onSoloFocusPostSuccess={({
                      questionId,
                      answerValue,
                      discovery,
                      discovery_win,
                      new_discovery_card,
                      grid_context,
                      morphCards,
                      userContext,
                      researchAttribution: ra,
                      sourceCitation: citeSnap,
                      hasNextQuestion,
                      newTotals,
                    }) => {
                      setQuestionCount((c) => c + 1)
                      const isLoopComplete = questionCount >= 5 || !hasNextQuestion
                      if (
                        newTotals &&
                        typeof newTotals.totalMoney === 'number' &&
                        typeof newTotals.totalCarbon === 'number'
                      ) {
                        setHeroTotalsOverride({
                          money: Math.max(0, Math.round(newTotals.totalMoney)),
                          carbon: Math.max(0, Math.round(newTotals.totalCarbon)),
                        })
                        setIsGlitchingMoney(true)
                        setTimeout(() => setIsGlitchingMoney(false), 500)
                      }
                      if (userContext) setUserContextSnap(userContext)
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
                        morphCards && morphCards.length > 0
                          ? morphCards
                          : [fallbackMorphCard]
                      if (incomingMorphCards.length > 0) {
                        const prioritized = prioritizeMorphCardsForContext(incomingMorphCards, {
                          postcode: profilePostcode,
                          local: state.locationState?.local ?? null,
                          profile: state.profile,
                          journeyAnswers: state.journeyAnswers as Record<string, Record<string, string>>,
                        })
                        setMorphedCardsQueue((prev) => {
                          const next = [...prev, prioritized[0]]
                          setActiveSiblingIndex(next.length)
                          return next
                        })
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
                      if (!isLoopComplete) {
                        persistViewState('QUESTION', { preserveResultContext: true })
                      } else {
                        persistViewState('RESULT')
                        onJourneyAnswered?.()
                      }

                      onEmbeddedAnswerSuccess?.({ cardId })

                      // 3. Zip-open with the new card instantly
                      setLoopZipCollapsing(false)
                    }}
                      onSourceCitation={(c) => setResultCitation(c)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
          </motion.div>
        </motion.div>

      </motion.div>
      {!isZoneMotherChild && (
      <div className="fixed right-5 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
        <motion.button
          type="button"
          aria-label="Close"
          className="circle-btn flex items-center justify-center"
          onClick={handleClose}
          whileTap={{ scale: 0.9 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={ELASTIC_PING.transition}
          style={{
            width: 40,
            height: 40,
            backgroundColor: 'var(--color-purple)',
            color: 'var(--color-yellow)',
          }}
        >
          <BackArrowDownLeft size={20} />
        </motion.button>
        {(activeCardId || cardId) && (
          <motion.button
            type="button"
            className="circle-btn flex items-center justify-center"
            onClick={() => {
              triggerHaptic('medium')
              const id = String(activeCardId || cardId)
              const likeFn = onLike ?? toggleLike
              likeFn(id, displayTitle, parseMoneyGbpFromImpactDisplay(String(displayMoneyValue)))
            }}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={ELASTIC_PING.transition}
            aria-label="Like"
            style={{
              width: 40,
              height: 40,
              backgroundColor: isLiked ? 'var(--color-yellow)' : 'var(--color-purple)',
              color: isLiked ? 'var(--color-purple)' : 'var(--color-yellow)',
            }}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill={isLiked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </motion.button>
        )}
        {onAskZai && (
          <motion.button
            type="button"
            className="circle-btn flex items-center justify-center"
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
              const trapQuestion = !trapComplete && discoveryFollowUp?.question?.trim() ? discoveryFollowUp.question.trim() : ''
              const zaiLabel = soloEmbedQuestionLabel?.trim() || trapQuestion || null
              setAskZaiContext({
                category: displayCategory,
                personalSpend: String(displayMoneyValue).replace(/^£\s*/, '').trim() || '0',
                regionalAvg: String(displayCarbonValue).replace(/\s*(kg|t)\s*CO₂$/i, '').trim() || '0',
                question: buildSoloFocusAskZaiQuestion(displayTitle, zaiLabel),
                journey_question_label: zaiLabel,
                userContext: userContextSnap,
                scraped_source: sourceLabel || sourceUrl || '',
                journey_answers_jsonb: allAnswers
              })
              handleClose()
              onAskZai()
            }}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={ELASTIC_PING.transition}
            aria-label="Ask Zai about this"
            style={{
              width: 40,
              height: 40,
              backgroundColor: 'var(--color-purple)',
              color: 'var(--color-yellow)',
            }}
          >
            <svg
              width={20}
              height={20}
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
          </motion.button>
        )}
      </div>
      )}
      </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(overlay, document.body)
  }
  return null
}
