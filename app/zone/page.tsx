'use client'

import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, LayoutGroup } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { buildZoneViewModel } from '@/lib/logic/zone'
import { sanitizeArchitectProseForJourney } from '@/lib/zone/contentProseSanitize'
import { ZAI_AUDIT_COMPLETE_EVENT } from '@/lib/zai/zoneSync'
import { buildGroovyGridItems, type GroovyGridCell } from '@/lib/zone/gridOrder'
import {
  markCardVisited,
  mergeVisitedFromServer,
  readDeepDiveInProgressCardId,
  readVisitedCardIds,
  recordCardVisitHandoff,
  setDeepDiveInProgress,
} from '@/lib/zone/visitedCards'
import { rememberSoloFocusOpen, readSessionMemory } from '@/lib/zone/sessionMemory'
import { openZoneExternalHandoff } from '@/lib/zone/zoneHandoff'
import type { ZoneViewModel, ZoneJourneyCard, ZoneTipCard, NeonJourneyResearchRow } from '@/lib/logic/zone'
import {
  applyArchitectEnrichment,
  architectCacheFingerprint,
  type ArchitectJourneyPayload,
} from '@/lib/agents/contentArchitect'
import { buildContentArchitectCardPayload } from '@/lib/zone/architectZoneRequest'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import {
  inferRevenueCtaKind,
  pickFirstHttpUrl,
  resolveRevenueCtaLabel,
} from '@/lib/zone/verifiedRevenue'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import { ROUTES } from '@/lib/routes'
import { useCountUp } from '@/lib/utils/useCountUp'
import {
  ZONE_BENTO_CELL_VARIANTS,
  ZONE_GRID_STAGGER_CHILD_DELAY_SEC,
  FADE_IN_UP,
  ZONE_HERO_FROM_SUMMARY,
  ZONE_GRID_PUNCH_THROUGH,
  STACCATO_CONTAINER_VARIANTS,
  STACCATO_CHILD_VARIANTS,
} from '@/lib/animations'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_EXIT,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

import { parseZoneCoverageFromApi, parseResearchMetaFromApi } from '@/lib/zone/parseScrapeSyncClient'
import {
  readCachedProfileLocality,
  resolveProfileLocalityForPostcode,
} from '@/lib/geocode/resolvePostcodeLocality'
import { appendResearchUserIdQuery } from '@/lib/zone/garyMode'
import { TIER2_PROFILE_REFRESH_EVENT } from '@/lib/zone/tier2RecursiveSpawner'
import {
  readPostcodeFromUrl,
  readProfileFieldsFromStorage,
  readProfilePostcode,
  resolveScrapePostcode,
  safeGetItem,
  safeGetJson,
  safeSetItem,
} from '@/lib/zone/safeProfileStorage'
import { setExpandCard } from '@/lib/expandStorage'
import { UNIFIED_PROFILE_MEMORY_EVENT } from '@/lib/unifiedProfileMemory'
import { DISCOVERY_INJECT_EVENT } from '@/lib/discoveryInject'
import { AtomicLogo } from '@/app/components/Logo'
import { DiscoveryTakeover } from '@/app/components/DiscoveryTakeover'
import { pickNextLoopQuestion } from '@/lib/zone/loopQuestions'
import {
  isDiscoveryInjectCard,
  isZoneCardPink,
  shouldCloseMarkPinkOnly,
  shouldCloseToGridOnly,
  shouldOpenLoopTakeover,
} from '@/lib/zone/directorsOrder'
import { markLoopDoneForJourney } from '@/lib/zone/loopMemory'
import {
  persistPinnedAchievement,
  readPinnedAchievementsFromStorage,
} from '@/lib/zone/loopMemory'
import { spawnAchievementWhenLoopPoolExhausted } from '@/lib/zone/spawnAchievementOnClose'
import {
  SESSION_SUMMARY_TO_ZONE,
  ZONE_READY_MAX_WAIT_MS,
  buildZoneWelcomeCopy,
  computeIsZoneReady,
} from '@/lib/architecturalPulse'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import {
  bentoSpanClassForPersona,
  JOURNEY_BENTO_PERSONA,
  type BentoPersona,
} from '@/lib/zone/bentoPersona'
import {
  MAX_ZONE_CARD_HEADLINE_WORDS,
  formatZoneCategoryLabel,
  normalizeCardHeadlineKey,
  zoneCardHeadlineFromRaw,
} from '@/lib/soloFocusCopy'
import { dedupeZoneTipCards } from '@/lib/zone/injections'
import {
  capDiscoveryTipsForGrid,
  capRockHabitsPerJourney,
  capTipsPerJourney,
  isUserDiscoveryInjectTip,
  journeyKeyFromTip,
} from '@/lib/zone/perCategoryCardCap'
import { MAX_ROCK_SAVING_TIPS_RAIL } from '@/lib/zone/ulmLimits'
import {
  CATEGORY_INTENT_CHANGED_EVENT,
  bumpCategoryIntent,
  readCategoryIntentWeights,
} from '@/lib/zone/categoryIntent'
import { coverageRowToNeon, foldCoverageRowsForZone } from '@/lib/zone/neonResearchMerge'
import { runDiscoveryPulse, readStoredEconomyFingerprint, writeStoredEconomyFingerprint } from '@/lib/agents/heartbeat'
import { buildRemoteBehavioralZoneTips } from '@/lib/zone/remoteBehavioralZoneTips'
import {
  ENGINE_UI_LABELS,
} from '@/lib/logic/engine'
import { fetchLivingPulseSnapshot } from '@/lib/logic/pulse'
import {
  scheduleZoneEngineHydrationPhases,
  type ZoneEngineStatus,
} from '@/lib/zone/engineHydration'
import { ROCK_BY_SLUG, habitToTipCard, sumRockLikedImpact, rockCardId } from '@/lib/rock/habitsCatalog'
import { replaceRockSlotAfterLike } from '@/lib/rock/rotation'
import { useRockVisibleHabits } from '@/lib/rock/useRockVisibleHabits'
import { utcDayIndex } from '@/lib/rock/rotation'
import { useSentinel } from '@/app/hooks/useSentinel'
import {
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import {
  bootstrapZoneCategoryResearch,
  zoneNeedsResearchBootstrap,
} from '@/lib/zone/bootstrapZoneResearch'
import { researchCategoryToJourneyKey } from '@/lib/zone/neonResearchMerge'
import ZoneDesktopNavRail from '@/app/components/ZoneDesktopNavRail'
import ZoneAskZaiDock from '@/app/components/ZoneAskZaiDock'
import { ArchitecturalPulse } from '@/app/components/ArchitecturalPulse'
import {
  AppFloatingNav,
  ZoneCard,
  RockSavingTips,
  SoloFocusOverlay,
} from '@/lib/visual'

function isDiscoveryTipPayload(x: unknown): x is ZoneTipCard {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const d = o.data as Record<string, unknown> | undefined
  return (
    typeof o.id === 'string' &&
    o.id.startsWith('inject-') &&
    typeof o.title === 'string' &&
    typeof o.journey_key === 'string' &&
    !!d &&
    typeof d.money === 'string' &&
    typeof d.carbon === 'string'
  )
}

type GroovyItem = GroovyGridCell

const UNLOCKED_COUNT_KEY = 'zoneUnlockedCount'
const SENTINEL_RECENT_CHAT_KEY = 'zz_recent_chat_history'
const ANSWER_COMMITTED_EVENT = 'zz_answer_committed'

function inferHouseholdSize(label?: string): number | undefined {
  const t = (label ?? '').toLowerCase()
  if (!t) return undefined
  if (t.includes('alone') || t.includes('single')) return 1
  if (t.includes('couple')) return 2
  if (t.includes('family')) return 4
  if (t.includes('shared') || t.includes('housemate')) return 3
  return undefined
}

function sumJourneyGridTotals(vm: ZoneViewModel): { totalMoney: number; totalCarbon: number } {
  const journeyTotals = vm.journeys.reduce(
    (acc, card) => {
      acc.totalMoney += Math.max(0, Number(card.moneyGbp ?? parseMoneyGbpFromDisplay(card.data?.money ?? '0')))
      acc.totalCarbon += Math.max(0, Number(card.carbonKg ?? parseCarbonKgFromDisplay(card.data?.carbon ?? '0')))
      return acc
    },
    { totalMoney: 0, totalCarbon: 0 }
  )
  return {
    totalMoney: journeyTotals.totalMoney,
    totalCarbon: journeyTotals.totalCarbon,
  }
}

function readRecentChatHistoryFromStorage(): Array<{ role: 'user' | 'zai'; text: string }> {
  if (typeof window === 'undefined') return []
  try {
    const raw = safeGetItem(SENTINEL_RECENT_CHAT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{ role?: unknown; text?: unknown }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(
        (m): { role: 'user' | 'zai'; text: string } => ({
          role: m?.role === 'user' ? 'user' : 'zai',
          text: typeof m?.text === 'string' ? m.text.trim() : '',
        })
      )
      .filter((m) => m.text.length > 0)
      .slice(-12)
  } catch {
    return []
  }
}

/** Placeholder VM — shown at skeleton opacity until scrape-sync / Neon research hydrates. */
function getPlaceholderZoneViewModel(): ZoneViewModel {
  const emptyAnswers = {} as Record<JourneyId, Record<string, string>>
  return buildZoneViewModel({ profile: {}, journeyAnswers: emptyAnswers })
}

function neonJourneyResearchFromCoverage(
  cov: Record<string, ResearchCategoryCoverageRow> | null | undefined
): Partial<Record<JourneyId, NeonJourneyResearchRow>> | undefined {
  if (!cov) return undefined
  const out: Partial<Record<JourneyId, NeonJourneyResearchRow>> = {}
  for (const jid of JOURNEY_ORDER) {
    const row = cov[jid]
    if (!row) continue
    const neon = coverageRowToNeon(row, jid)
    if (neon) out[jid] = neon
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export default function ZonePage() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const { state, toggleLike, setHeroTotals, setLocationState, openSoloFocus, closeSoloFocus, refreshProfile } = useApp()

  const [viewModel, setViewModel] = useState<ZoneViewModel>(getPlaceholderZoneViewModel)
  const [vmSyncStamp, setVmSyncStamp] = useState(0)
  const [completedJourneys, setCompletedJourneys] = useState<JourneyId[]>([])
  const [scraped, setScraped] = useState<Record<JourneyId, { scraped_at: string; carbon_value: number; money_value: number; deep_content_tip?: string; high_saving?: boolean }> | null>(null)
  const [localData, setLocalData] = useState<LocalIntelligence | null>(null)
  const [localJustLoaded, setLocalJustLoaded] = useState(false)
  /** In-grid reflow: expanded card gets grid-column 1 / -1 and pushes siblings (no overlay) */
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  /** When user opened a tip and we expanded the matching journey card, keep the tip so Solo Focus shows offer copy + impact */
  const [expandedFromTip, setExpandedFromTip] = useState<ZoneTipCard | null>(null)
  /** Tip expand: full-screen tip overlay */
  const [expandedTipId, setExpandedTipId] = useState<string | null>(null)
  /** S Update: bump to re-read localStorage after embedded question submit */
  const [refreshKey, setRefreshKey] = useState(0)
  const [categoryIntentWeights, setCategoryIntentWeights] = useState(() =>
    typeof window !== 'undefined' ? readCategoryIntentWeights() : {}
  )

  useEffect(() => {
    const syncIntent = () => setCategoryIntentWeights(readCategoryIntentWeights())
    window.addEventListener(CATEGORY_INTENT_CHANGED_EVENT, syncIntent)
    return () => window.removeEventListener(CATEGORY_INTENT_CHANGED_EVENT, syncIntent)
  }, [])

  const trackZoneLike = useCallback(
    (id: string, title?: string, moneyGbp?: number) => {
      const tip = viewModel.tips.find((t) => t.id === id)
      const journey = viewModel.journeys.find((j) => j.id === id)
      const jid = tip?.journey_key ?? journey?.journey_key
      if (jid) bumpCategoryIntent(jid, 'like')
      toggleLike(id, title, moneyGbp)
      setCategoryIntentWeights(readCategoryIntentWeights())
      setRefreshKey((k) => k + 1)
    },
    [toggleLike, viewModel.tips, viewModel.journeys]
  )

  useEffect(() => {
    const onZaiAuditComplete = () => setRefreshKey((k) => k + 1)
    window.addEventListener(ZAI_AUDIT_COMPLETE_EVENT, onZaiAuditComplete)
    return () => window.removeEventListener(ZAI_AUDIT_COMPLETE_EVENT, onZaiAuditComplete)
  }, [])

  /** Zone lock: all twelve domains visible on the wall. */
  const [unlockedCount, setUnlockedCount] = useState(12)
  const [hydrated, setHydrated] = useState(false)
  /** v1.7: index of the journey card that just popped in; cleared after animation. */
  /** Discovery Engine: server-stored tip injections (GET /api/zone/injections). */
  const [injectedTips, setInjectedTips] = useState<ZoneTipCard[]>([])
  /** Discovery Pulse: patch £/kg on inject cards when economy fingerprint changes. */
  const [tipDataPatches, setTipDataPatches] = useState<Record<string, { money?: string; carbon?: string }>>({})
  /** Fussy-snap target for freshly injected discovery card. */
  const [discoverySnapTipId, setDiscoverySnapTipId] = useState<string | null>(null)
  /** Bump when a Rock slot is replaced after Like (zip-shutter). */
  const [rockRefreshKey, setRockRefreshKey] = useState(0)
  /** One-shot hero zoom after profile summary Zip-Shutter → Zone */
  const [heroFromSummaryHandoff, setHeroFromSummaryHandoff] = useState(false)
  /** Bump so bento `staggerChildren` replays when landing from `/profile/summary` (last staccato word → grid drop). */
  const [summaryGridStaggerKey, setSummaryGridStaggerKey] = useState(0)
  /** Post-summary Architectural Pulse → grid punch-through. */
  const [architecturalPulsePhase, setArchitecturalPulsePhase] = useState<
    'idle' | 'glitch' | 'pulse' | 'punch' | 'done'
  >('done')
  const [pulseWordsComplete, setPulseWordsComplete] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return sessionStorage.getItem(SESSION_SUMMARY_TO_ZONE) !== '1'
    } catch {
      return true
    }
  })
  const architecturalPulsePhaseRef = useRef(architecturalPulsePhase)
  architecturalPulsePhaseRef.current = architecturalPulsePhase
  /** Pink achievement cards pinned directly under profile hero. */
  const [pinnedAchievements, setPinnedAchievements] = useState<ZoneTipCard[]>([])
  /** Pattern-shift question after Solo Focus close (exclusive full-screen focus). */
  const [patternShiftJourneyId, setPatternShiftJourneyId] = useState<JourneyId | null>(null)
  /** Clean Birth: hide Zone grid/anchor until post-answer pulse completes. */
  const [isZoneVisible, setIsZoneVisible] = useState(true)
  const [cleanBirthRevealKey, setCleanBirthRevealKey] = useState(0)
  /** After answering the last question on a journey: contextual line for the next tile we open */
  const [sentinelPingJourneyKeys, setSentinelPingJourneyKeys] = useState<Record<string, boolean>>({})
  const [sentinelHeroPing, setSentinelHeroPing] = useState(false)
  const [heroLiveGrounded, setHeroLiveGrounded] = useState(false)
  const [sentinelPulseLabel, setSentinelPulseLabel] = useState<string | null>(null)
  const [dbConnected, setDbConnected] = useState(true)
  const [dbHealthHint, setDbHealthHint] = useState<string | null>(null)
  const [vmResolved, setVmResolved] = useState(true)
  const scrapeSyncGenRef = useRef(0)
  const [revealedCardCount, setRevealedCardCount] = useState(0)
  const [engineStatus, setEngineStatus] = useState<ZoneEngineStatus>('idle')
  const zoneBootstrapRef = useRef(false)
  const [marketContext, setMarketContext] = useState<{
    liveProfilePostcode?: string
    april2026PriceCapGbp?: number
    regionalGridIntensityGPerKwh?: number
    liveResearchData?: boolean
    deepLink?: string
    verifiedSaving?: number
    savingAmountGbp?: number
    localityContext?: string
    homeUnitRates?: { elecGbpPerKwh: number; gasGbpPerKwh: number }
  } | null>(null)
  /** Neon or April 2026 fallback — from GET /api/scrape-sync (same resolver as /api/summary). */
  const [homeUnitRates, setHomeUnitRates] = useState<{
    elecGbpPerKwh: number
    gasGbpPerKwh: number
  } | null>(null)
  const [ratesSourceUrl, setRatesSourceUrl] = useState<string | null>(null)
  const [liveResearchData, setLiveResearchData] = useState(false)
  const [researchMeta, setResearchMeta] = useState<{
    deepLink?: string
    offerUrl?: string
    verifiedSaving?: number
    savingAmountGbp?: number
    localityContext?: string
    auditSourceUrl?: string
    category?: string | null
    architectProse?: string
  } | null>(null)
  const [researchCategoryCoverage, setResearchCategoryCoverage] = useState<Record<
    string,
    ResearchCategoryCoverageRow
  > | null>(null)
  const [insightPendingKeys, setInsightPendingKeys] = useState<Set<string>>(() => new Set())
  const [liveProfilePostcode, setLiveProfilePostcode] = useState('')

  /** Client-only: safe storage (avoids SSR / SecurityError crashes). */
  useEffect(() => {
    setHydrated(true)
    setLiveProfilePostcode(readProfilePostcode())
    const fromUrl = readPostcodeFromUrl()
    if (fromUrl) safeSetItem('profile_postcode', fromUrl)
    const storedPins = readPinnedAchievementsFromStorage()
    if (storedPins.length > 0) {
      setPinnedAchievements((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]))
        for (const c of storedPins) byId.set(c.id, c)
        return [...byId.values()]
      })
      setInjectedTips((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]))
        for (const c of storedPins) byId.set(c.id, c)
        return [...byId.values()]
      })
    }
  }, [refreshKey])

  const isFocusViewOpen = Boolean(expandedCardId || expandedTipId)

  const closeAnySoloFocus = useCallback(() => {
    setExpandedCardId(null)
    setExpandedFromTip(null)
    setExpandedTipId(null)
    closeSoloFocus()
  }, [closeSoloFocus])

  const pinAchievementCard = useCallback((card: ZoneTipCard) => {
    if (!card.achievement_discovery) return
    markCardVisited(card.id)
    setInjectedTips((prev) => [...prev.filter((c) => c.id !== card.id), card])
    setPinnedAchievements((prev) => [...prev.filter((c) => c.id !== card.id), card])
    persistPinnedAchievement(card)
    setVmSyncStamp(Date.now())
  }, [])

  const loopCompletedJourneyRef = useRef<JourneyId | null>(null)
  const loopCloseCardIdRef = useRef<string | null>(null)
  const [visitedCardIds, setVisitedCardIds] = useState<Set<string>>(() => readVisitedCardIds())

  const launchPatternShiftTakeover = useCallback(
    (journeyId: JourneyId, meta?: { cardId?: string; visitedClose?: boolean }) => {
      closeAnySoloFocus()
      loopCloseCardIdRef.current = meta?.cardId?.trim() || null
      if (shouldCloseToGridOnly(meta?.visitedClose)) {
        const closeId = meta?.cardId?.trim()
        if (closeId) {
          markCardVisited(closeId)
          setVisitedCardIds(readVisitedCardIds())
        }
        loopCloseCardIdRef.current = null
        setPatternShiftJourneyId(null)
        setIsZoneVisible(true)
        return
      }
      if (!shouldOpenLoopTakeover(meta?.cardId, journeyId)) {
        loopCloseCardIdRef.current = null
        setPatternShiftJourneyId(null)
        setIsZoneVisible(true)
        return
      }
      const nextBeat = pickNextLoopQuestion(journeyId)
      if (nextBeat) {
        loopCompletedJourneyRef.current = journeyId
        setIsZoneVisible(false)
        setPatternShiftJourneyId(journeyId)
        return
      }
      spawnAchievementWhenLoopPoolExhausted(journeyId, pinAchievementCard)
      setPatternShiftJourneyId(null)
      setIsZoneVisible(true)
      setCleanBirthRevealKey((k) => k + 1)
      setVmSyncStamp(Date.now())
    },
    [closeAnySoloFocus, pinAchievementCard]
  )

  const completeCleanBirth = useCallback(() => {
    const loopJid = loopCompletedJourneyRef.current
    loopCompletedJourneyRef.current = null
    setPatternShiftJourneyId(null)
    closeAnySoloFocus()
    setExpandedCardId(null)
    setExpandedFromTip(null)
    setExpandedTipId(null)
    setIsZoneVisible(true)
    setCleanBirthRevealKey((k) => k + 1)
    setRevealedCardCount((n) => Math.max(n, 1 + pinnedAchievements.length))
    setRefreshKey((k) => k + 1)
    setVmSyncStamp(Date.now())
    if (loopJid) {
      markLoopDoneForJourney(loopJid)
      const closedId = loopCloseCardIdRef.current
      loopCloseCardIdRef.current = null
      if (closedId) {
        markCardVisited(closedId)
      } else {
        for (const j of viewModel.journeys) {
          if (j.journey_key === loopJid) markCardVisited(j.id)
        }
      }
      setVisitedCardIds(readVisitedCardIds())
    }
  }, [closeAnySoloFocus, pinnedAchievements.length, viewModel.journeys])

  /** Set synchronously before expand setState so the recovery guard does not close Solo Focus mid-open. */
  const soloFocusExpandIntentRef = useRef<string | null>(null)
  const expandedCardIdRef = useRef<string | null>(null)
  const expandedTipIdRef = useRef<string | null>(null)
  useEffect(() => {
    expandedCardIdRef.current = expandedCardId
  }, [expandedCardId])
  useEffect(() => {
    expandedTipIdRef.current = expandedTipId
  }, [expandedTipId])
  useEffect(() => {
    if (!state.soloFocus.activeCardId) return
    if (expandedCardId || expandedTipId) {
      if (soloFocusExpandIntentRef.current === state.soloFocus.activeCardId) {
        soloFocusExpandIntentRef.current = null
      }
      return
    }
    const activeId = state.soloFocus.activeCardId
    if (soloFocusExpandIntentRef.current === activeId) return
    const t = window.setTimeout(() => {
      if (soloFocusExpandIntentRef.current === activeId) return
      if (expandedCardIdRef.current || expandedTipIdRef.current) return
      closeSoloFocus()
    }, 120)
    return () => window.clearTimeout(t)
  }, [state.soloFocus.activeCardId, expandedCardId, expandedTipId, closeSoloFocus])

  const [recentChatHistory] = useState<Array<{ role: 'user' | 'zai'; text: string }>>(() =>
    readRecentChatHistoryFromStorage()
  )
  const sentinelImpactTotals = useMemo(
    () => ({
      totalMoney: state.heroTotals?.totalMoney ?? 0,
      totalCarbon: state.heroTotals?.totalCarbon ?? 0,
    }),
    [state.heroTotals?.totalMoney, state.heroTotals?.totalCarbon]
  )
  const sentinel = useSentinel({
    userAnswers: state.journeyAnswers,
    impactTotals: sentinelImpactTotals,
    recentChatHistory,
  })
  const homeSentinelSupportActive = Boolean(sentinel.grantFound && sentinel.firecrawlGrant?.title)
  const homeSupportTitle = sentinel.firecrawlGrant?.title ?? 'LIVE HEAT UPGRADE SUPPORT'
  const homeSupportOfferUrl = sentinel.firecrawlGrant?.claimOfferUrl ?? ''
  const sentinelTipCards = useMemo<ZoneTipCard[]>(() => {
    return sentinel.priorities.slice(0, 3).map((priority, index) => {
      const personaTone = priority.journeyKey === 'home' || priority.journeyKey === 'waste' ? priority.bearTip : priority.wolfTip
      const efficiencySavings = Math.max(0, Math.round(priority.savingsGbp * 0.93))
      return {
        id: `inject-sentinel-${priority.journeyKey}-${index}`,
        variant: 'card-compact',
        title: priority.title,
        journey_key: priority.journeyKey,
        category: priority.journeyKey,
        data: {
          money: `£${efficiencySavings}`,
          carbon: `${Math.round(priority.carbonKg)} KG CO₂`,
        },
        explanation: [`Efficiency over switching: ${personaTone}`],
        sourceLabel: 'SENTINEL',
        source: '/zai',
        dominant_win: 'money',
        actions: { actionType: 'learn', learnUrl: '/zai', actionUrl: '/zai' },
      }
    })
  }, [sentinel.priorities])
  const remoteBehavioralTipCards = useMemo<ZoneTipCard[]>(() => {
    const postcode = (liveProfilePostcode || state.profile?.postcode || '').replace(/\s+/g, '').toUpperCase()
    if (!/^KW/i.test(postcode)) return []
    return buildRemoteBehavioralZoneTips()
  }, [liveProfilePostcode, state.profile?.postcode])

  const sentinelSupportTipCard = useMemo<ZoneTipCard | null>(() => {
    if (!sentinel.grantFound || !homeSupportOfferUrl) return null
    const postcode = (liveProfilePostcode || state.profile?.postcode || '').replace(/\s+/g, '').toUpperCase()
    if (!/^KW/.test(postcode)) return null
    return {
      id: 'inject-sentinel-rural-support',
      variant: 'card-compact',
      title: homeSupportTitle,
      journey_key: 'home',
      category: 'home',
      data: {
        money:
          typeof sentinel.firecrawlGrant?.totalRuralGrantGbp === 'number'
            ? `£${Math.round(sentinel.firecrawlGrant.totalRuralGrantGbp)}`
            : '£0',
        carbon: '0 KG CO₂',
      },
      explanation: ['Live support pathway grounded from scraped source for your postcode.'],
      sourceLabel: 'SENTINEL',
      source: homeSupportOfferUrl,
      dominant_win: 'money',
      badge: 'live',
      actions: { actionType: 'learn', learnUrl: homeSupportOfferUrl, actionUrl: homeSupportOfferUrl },
    }
  }, [
    homeSupportOfferUrl,
    homeSupportTitle,
    sentinel.firecrawlGrant?.totalRuralGrantGbp,
    sentinel.grantFound,
    liveProfilePostcode,
    state.profile?.postcode,
  ])
  /** Keep live discovery injections first so newly generated cards always surface. */
  const effectiveInjectedTips = useMemo(
    () =>
      dedupeZoneTipCards([
        ...(sentinelSupportTipCard ? [sentinelSupportTipCard] : []),
        ...remoteBehavioralTipCards,
        ...injectedTips,
        ...sentinelTipCards,
      ]),
    [sentinelSupportTipCard, remoteBehavioralTipCards, injectedTips, sentinelTipCards]
  )

  const rockSeed = `${state.userId ?? 'guest'}:d${utcDayIndex()}`
  const rockVisibleHabits = useRockVisibleHabits(state.likedCards, rockSeed, rockRefreshKey)

  useEffect(() => {
    if (sentinel.priorities.length === 0 || sentinel.wasSkipped) return
    const next: Record<string, boolean> = {}
    sentinel.priorities.forEach((p) => {
      next[p.journeyKey] = true
    })
    setSentinelPingJourneyKeys(next)
    const t = window.setTimeout(() => setSentinelPingJourneyKeys({}), 520)
    return () => window.clearTimeout(t)
  }, [sentinel.priorities, sentinel.wasSkipped])

  useEffect(() => {
    if (!homeSentinelSupportActive) return
    setSentinelPingJourneyKeys((prev) => ({ ...prev, home: true }))
    const t = window.setTimeout(() => {
      setSentinelPingJourneyKeys((prev) => {
        const next = { ...prev }
        delete next.home
        return next
      })
    }, 520)
    return () => window.clearTimeout(t)
  }, [homeSentinelSupportActive, sentinel.lastRefreshed])

  useEffect(() => {
    if (!sentinelSupportTipCard) return
    setDiscoverySnapTipId(sentinelSupportTipCard.id)
    const t = window.setTimeout(() => {
      setDiscoverySnapTipId((id) => (id === sentinelSupportTipCard.id ? null : id))
    }, 720)
    return () => window.clearTimeout(t)
  }, [sentinelSupportTipCard])

  useEffect(() => {
    if (!sentinel.liveImpact || sentinel.wasSkipped) return
    setSentinelHeroPing(true)
    const t = window.setTimeout(() => setSentinelHeroPing(false), 560)
    return () => window.clearTimeout(t)
  }, [sentinel.liveImpact, sentinel.lastRefreshed, sentinel.wasSkipped])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem(SESSION_SUMMARY_TO_ZONE) === '1') {
        sessionStorage.removeItem(SESSION_SUMMARY_TO_ZONE)
        setHeroFromSummaryHandoff(true)
        setSummaryGridStaggerKey((k) => k + 1)
        setPulseWordsComplete(false)
        setArchitecturalPulsePhase('pulse')
      }
    } catch {
      //
    }
  }, [])

  // v41.0 Live Audit Sync: refresh cards as soon as postcode mutates in profile storage.
  useEffect(() => {
    if (!hydrated) return
    let prev = readProfilePostcode()
    setLiveProfilePostcode(prev)
    const bumpIfChanged = (nextRaw: string) => {
      const next = nextRaw.replace(/\s+/g, '').toUpperCase()
      if (next === prev) return
      if (next.length < 4) return
      prev = next
      setLiveProfilePostcode(prev)
      setVmSyncStamp(Date.now())
      setRefreshKey((k) => k + 1)
    }
    const interval = window.setInterval(() => {
      bumpIfChanged(safeGetItem('profile_postcode') ?? '')
    }, 2500)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'profile_postcode') return
      bumpIfChanged(e.newValue ?? '')
    }
    const onUnifiedProfile = () => {
      refreshProfile()
      bumpIfChanged(safeGetItem('profile_postcode') ?? '')
      setVmSyncStamp(Date.now())
      setRefreshKey((k) => k + 1)
    }
    window.addEventListener('storage', onStorage)
    const onPostcodeChanged = () => {
      bumpIfChanged(safeGetItem('profile_postcode') ?? '')
    }
    window.addEventListener('zz-postcode-changed', onPostcodeChanged)
    const onTier2Refresh = (e: Event) => {
      const detail = (e as CustomEvent<{ totalMoney?: number; totalCarbon?: number }>).detail
      if (detail && typeof detail.totalMoney === 'number' && typeof detail.totalCarbon === 'number') {
        setHeroTotals({ totalMoney: detail.totalMoney, totalCarbon: detail.totalCarbon })
      }
      refreshProfile()
      bumpIfChanged(safeGetItem('profile_postcode') ?? '')
      setVmSyncStamp(Date.now())
      setRefreshKey((k) => k + 1)
    }
    window.addEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onUnifiedProfile)
    window.addEventListener(TIER2_PROFILE_REFRESH_EVENT, onTier2Refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('zz-postcode-changed', onPostcodeChanged)
      window.removeEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onUnifiedProfile)
      window.removeEventListener(TIER2_PROFILE_REFRESH_EVENT, onTier2Refresh)
    }
  }, [refreshProfile, hydrated, setHeroTotals])

  // Allow page scroll when expanded (no body scroll lock)

  // Local Living: fetch council + regional carbon; postcode from localStorage (primary) or profile context
  useEffect(() => {
    if (!hydrated) return
    const raw = resolveScrapePostcode(liveProfilePostcode, state.profile?.postcode)?.replace(/\s+/g, '').trim()
    // UK outward codes: do not silently substitute Wick — that reads as a "failed" postcode lookup.
    if (!raw || raw.length < 2) {
      setLocalData(null)
      return
    }
    const postcode = raw
    fetch(`/api/profile/locality?postcode=${encodeURIComponent(postcode)}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.local?.council) {
          const resolved = data.local as LocalIntelligence
          const locationName =
            (typeof data.label === 'string' && data.label.trim()) ||
            formatLocationDisplayName(resolved, postcode)
          setLocalData(resolved)
          if (locationName) {
            setLocationState({
              local: resolved,
              locationName,
            })
          }
          setLocalJustLoaded(true)
        }
      })
      .catch(() => {})
  }, [hydrated, liveProfilePostcode, state.profile?.postcode, setLocationState])

  useEffect(() => {
    if (!localJustLoaded) return
    const t = setTimeout(() => setLocalJustLoaded(false), 1200)
    return () => clearTimeout(t)
  }, [localJustLoaded])

  // Public DB ping once per mount — avoid re-fetch on refreshKey bumps (discovery inject / tips refresh).
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    fetch('/api/health', { cache: 'no-store' })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as {
          status?: string
          database?: string
          error?: string
        } | null
        if (cancelled) return
        if (r.ok && body?.status === 'ok' && body?.database === 'connected') {
          setDbConnected(true)
          setDbHealthHint(null)
          return
        }
        setDbConnected(false)
        const hint =
          r.status === 503
            ? typeof body?.error === 'string' && body.error.trim()
              ? body.error.trim()
              : 'Database unreachable — set DATABASE_URL (Neon) in .env.local or Vercel env.'
            : `GET /api/health → HTTP ${r.status}`
        setDbHealthHint(hint)
      })
      .catch(() => {
        if (!cancelled) {
          setDbConnected(false)
          setDbHealthHint('Network error calling /api/health')
        }
      })
    return () => {
      cancelled = true
    }
  }, [hydrated])

  const scrapePostcode = useMemo(
    () => resolveScrapePostcode(liveProfilePostcode, state.profile?.postcode ?? null),
    [liveProfilePostcode, state.profile?.postcode]
  )

  const displayLocationName = useMemo(() => {
    const cached = scrapePostcode.length >= 4 ? readCachedProfileLocality(scrapePostcode) : null
    if (cached) return cached
    return formatLocationDisplayName(localData ?? undefined, scrapePostcode)
  }, [localData, scrapePostcode])

  const [dbVisitedJourneyKeys, setDbVisitedJourneyKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!hydrated) return
    if (scrapePostcode.length < 4) return
    void resolveProfileLocalityForPostcode(scrapePostcode)
  }, [hydrated, scrapePostcode])

  useEffect(() => {
    if (!hydrated) return
    void fetch('/api/session-state', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || typeof data !== 'object') return
        const ids = Array.isArray((data as { visitedCardIds?: unknown }).visitedCardIds)
          ? ((data as { visitedCardIds: string[] }).visitedCardIds ?? [])
          : []
        const jks = Array.isArray((data as { visitedJourneyKeys?: unknown }).visitedJourneyKeys)
          ? ((data as { visitedJourneyKeys: string[] }).visitedJourneyKeys ?? [])
          : []
        if (ids.length > 0) mergeVisitedFromServer(ids, jks)
        if (jks.length > 0) {
          setDbVisitedJourneyKeys((prev) => new Set([...prev, ...jks]))
        }
      })
      .catch(() => {})
  }, [hydrated])

  const inPlacePhrase = displayLocationName.trim() ? `in ${displayLocationName.trim()}` : 'near you'

  useEffect(() => {
    if (!hydrated) return
    const postcode = scrapePostcode
    if (postcode.length < 4) {
      setVmResolved(true)
      setEngineStatus('idle')
      return
    }
    const url = appendResearchUserIdQuery(`/api/scrape-sync?postcode=${encodeURIComponent(postcode)}`)
    const syncGen = ++scrapeSyncGenRef.current
    let clearHydrationPhases: (() => void) | null = null
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), ZONE_READY_MAX_WAIT_MS)
    setEngineStatus('scraping')
    clearHydrationPhases = scheduleZoneEngineHydrationPhases((phase) => setEngineStatus(phase))
    fetch(url, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const parsedMeta = parseResearchMetaFromApi(data)
        const verifiedSaving = parsedMeta?.verifiedSaving
        const savingAmountGbp = parsedMeta?.savingAmountGbp
        const architectProse = parsedMeta?.architectProse
        setResearchMeta(parsedMeta)
        const vjkRaw = Array.isArray((data as { visited_journey_keys?: unknown })?.visited_journey_keys)
          ? (data as { visited_journey_keys: unknown[] }).visited_journey_keys
          : []
        const vjk = vjkRaw.filter((j): j is string => typeof j === 'string' && j.length > 0)
        if (vjk.length > 0) {
          setDbVisitedJourneyKeys(new Set(vjk))
          for (const j of vjk) bumpCategoryIntent(j, 'visited')
        }
        const next = parseZoneCoverageFromApi(data)
        if (next) {
          setResearchCategoryCoverage(next)
          setInsightPendingKeys((prev) => {
            const n = new Set(prev)
            for (const jid of prev) {
              const row = next[jid]
              if (
                row?.insightReady ||
                (row?.latestSavingGbp ?? 0) > 0 ||
                (row?.latestVerifiedGbp ?? 0) > 0 ||
                row?.hasOffer
              ) {
                n.delete(jid)
              }
            }
            return n
          })
        } else {
          setResearchCategoryCoverage(null)
        }
        setLiveResearchData(
          Boolean(
            data?.source === 'database' ||
              data?.source === 'research_results' ||
              verifiedSaving != null ||
              savingAmountGbp != null ||
              parsedMeta?.deepLink ||
              architectProse
          )
        )
        const rawRates = data?.home_unit_rates as { elecGbpPerKwh?: unknown; gasGbpPerKwh?: unknown } | undefined
        if (rawRates && typeof rawRates === 'object') {
          const e = Number(rawRates.elecGbpPerKwh)
          const g = Number(rawRates.gasGbpPerKwh)
          if (Number.isFinite(e) && Number.isFinite(g) && e > 0 && g > 0) {
            setHomeUnitRates({ elecGbpPerKwh: e, gasGbpPerKwh: g })
          } else {
            setHomeUnitRates(null)
          }
        } else {
          setHomeUnitRates(null)
        }
        setRatesSourceUrl(typeof data?.rates_source_url === 'string' ? data.rates_source_url : null)
        const src = typeof data?.source === 'string' ? data.source : ''
        const covReady = next != null && Object.keys(next).length > 0
        const feedReady =
          src === 'database' ||
          src === 'research_results' ||
          src === 'defaults' ||
          covReady ||
          verifiedSaving != null ||
          (savingAmountGbp != null && savingAmountGbp > 0) ||
          Boolean(architectProse?.trim()) ||
          (Array.isArray(data?.scraped) && data.scraped.length > 0 && src !== 'pending')
        if (feedReady || src === 'pending') setVmResolved(true)

        if (data?.scraped && Array.isArray(data.scraped)) {
          type ScrapedJourneyRow = {
            journey_key: string
            scraped_at: string
            carbon_value: number
            money_value: number
            deep_content_tip?: string
            high_saving?: boolean
          }
          const map: Record<string, { scraped_at: string; carbon_value: number; money_value: number; deep_content_tip?: string; high_saving?: boolean }> = {}
          data.scraped.forEach((s: ScrapedJourneyRow) => {
            map[s.journey_key] = {
              scraped_at: s.scraped_at,
              carbon_value: s.carbon_value,
              money_value: s.money_value,
              deep_content_tip: s.deep_content_tip,
              high_saving: s.high_saving,
            }
          })
          setScraped(map as Record<JourneyId, { scraped_at: string; carbon_value: number; money_value: number; deep_content_tip?: string; high_saving?: boolean }>)
        }
      })
      .catch(() => {
        setLiveResearchData(false)
        setResearchMeta(null)
        setResearchCategoryCoverage(null)
        setHomeUnitRates(null)
        setRatesSourceUrl(null)
        setVmResolved(true)
      })
      .finally(() => {
        window.clearTimeout(abortTimer)
        clearHydrationPhases?.()
        if (syncGen !== scrapeSyncGenRef.current) return
        setEngineStatus('idle')
        setVmResolved(true)
      })
    return () => {
      controller.abort()
      window.clearTimeout(abortTimer)
      clearHydrationPhases?.()
    }
  }, [scrapePostcode, hydrated])

  const proseRepairRequestedRef = useRef(false)
  /** One content-architect batch per profile/answers fingerprint — stops 20s×N Gemini on refreshKey bumps. */
  const architectBatchKeyRef = useRef<string | null>(null)
  /** When GET scrape-sync returns empty £ rows, seed core categories in the background. */
  useEffect(() => {
    if (!hydrated || scrapePostcode.length < 4 || zoneBootstrapRef.current) return
    if (!vmResolved) return
    if (
      !zoneNeedsResearchBootstrap({
        coverage: researchCategoryCoverage,
        savingAmountGbp: researchMeta?.savingAmountGbp,
        verifiedSaving: researchMeta?.verifiedSaving,
      })
    ) {
      return
    }
    zoneBootstrapRef.current = true
    const pf = readProfileFieldsFromStorage()
    bootstrapZoneCategoryResearch({
      postcode: scrapePostcode,
      coverage: researchCategoryCoverage,
      profileData: {
        postcode: scrapePostcode,
        home_type: pf.home_type,
        transport_baseline: pf.transport_baseline,
        household: pf.household,
        employment_status: pf.employment_status,
      },
    })
  }, [
    hydrated,
    scrapePostcode,
    vmResolved,
    researchCategoryCoverage,
    researchMeta?.savingAmountGbp,
    researchMeta?.verifiedSaving,
    dbVisitedJourneyKeys,
  ])

  /* JIT: no batch POST scrape-sync for unsettled journeys — Tip +1 earns each scrape. */

  useEffect(() => {
    if (!hydrated || scrapePostcode.length < 4 || proseRepairRequestedRef.current) return
    const cov = researchCategoryCoverage
    if (!cov) return
    const needsProse = Object.entries(cov).some(
      ([jid, r]) =>
        !dbVisitedJourneyKeys.has(jid) &&
        ((r.latestSavingGbp ?? 0) > 0 || (r.latestVerifiedGbp ?? 0) > 0) &&
        !r.architectProse?.trim() &&
        !r.agentHeadline?.trim()
    )
    if (!needsProse) return
    proseRepairRequestedRef.current = true
    const url = appendResearchUserIdQuery(
      `/api/scrape-sync?postcode=${encodeURIComponent(scrapePostcode)}&repair=1`
    )
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const next = parseZoneCoverageFromApi(data)
        if (next) {
          setResearchCategoryCoverage(next)
          setInsightPendingKeys((prev) => {
            const n = new Set(prev)
            for (const jid of prev) {
              if (journeyResearchSettled(next[jid], { journeyId: jid as JourneyId })) n.delete(jid)
            }
            return n
          })
        }
        if (data?.scraped && Array.isArray(data.scraped)) {
          type ScrapedJourneyRow = {
            journey_key: string
            scraped_at: string
            carbon_value: number
            money_value: number
            deep_content_tip?: string
            high_saving?: boolean
          }
          const map: Record<
            string,
            {
              scraped_at: string
              carbon_value: number
              money_value: number
              deep_content_tip?: string
              high_saving?: boolean
            }
          > = {}
          data.scraped.forEach((s: ScrapedJourneyRow) => {
            map[s.journey_key] = {
              scraped_at: s.scraped_at,
              carbon_value: s.carbon_value,
              money_value: s.money_value,
              deep_content_tip: s.deep_content_tip,
              high_saving: s.high_saving,
            }
          })
          setScraped(
            map as Record<
              JourneyId,
              {
                scraped_at: string
                carbon_value: number
                money_value: number
                deep_content_tip?: string
                high_saving?: boolean
              }
            >
          )
          setLiveResearchData(true)
          setVmSyncStamp(Date.now())
        }
      })
      .catch(() => {
        proseRepairRequestedRef.current = false
      })
  }, [hydrated, scrapePostcode, researchCategoryCoverage, dbVisitedJourneyKeys])

  useEffect(() => {
    if (!hydrated) return
    safeSetItem(UNLOCKED_COUNT_KEY, '12')
  }, [unlockedCount, hydrated])

  useEffect(() => {
    let cancelled = false
    fetch('/api/zone/injections')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled) return
        const server = Array.isArray(data) ? (data as ZoneTipCard[]) : []
        const achievementFromServer = server.filter((c) => c?.achievement_discovery)
        if (achievementFromServer.length > 0) {
          setPinnedAchievements((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]))
            for (const c of achievementFromServer) {
              if (c?.id) byId.set(c.id, c)
            }
            return [...byId.values()]
          })
          for (const c of achievementFromServer) {
            if (c?.id) persistPinnedAchievement(c)
          }
        }
        setInjectedTips((prev) => {
          const byId = new Map<string, ZoneTipCard>()
          for (const c of server) {
            if (c?.id) byId.set(c.id, c)
          }
          for (const c of prev) {
            if (c.id.startsWith('inject-') && !byId.has(c.id)) byId.set(c.id, c)
          }
          const merged = dedupeZoneTipCards([...byId.values()])
          const achievements = merged.filter((c) => c.achievement_discovery)
          const userDiscovery = capTipsPerJourney(
            merged.filter(isUserDiscoveryInjectTip),
            1
          )
          const rest = merged.filter(
            (c) => !c.achievement_discovery && !isUserDiscoveryInjectTip(c)
          )
          return dedupeZoneTipCards([...achievements, ...userDiscovery, ...rest])
        })
      })
      .catch(() => {
        /* Keep optimistic client injections on fetch failure */
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    const onInject = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail
      if (!isDiscoveryTipPayload(detail)) return
      const isAchievement = Boolean(detail.achievement_discovery)
      setInjectedTips((prev) => {
        const titleKey = normalizeCardHeadlineKey(detail.title ?? '')
        const jid = journeyKeyFromTip(detail)
        const withoutDupes = prev.filter((c) => {
          if (c.id === detail.id) return false
          if (normalizeCardHeadlineKey(c.title ?? '') === titleKey) return false
          if (!isAchievement && isUserDiscoveryInjectTip(c) && journeyKeyFromTip(c) === jid) {
            return false
          }
          return true
        })
        return dedupeZoneTipCards([...withoutDupes, detail])
      })
      if (isAchievement) {
        setPinnedAchievements((prev) => [...prev.filter((c) => c.id !== detail.id), detail])
        persistPinnedAchievement(detail)
      }
      setDiscoverySnapTipId(detail.id)
      window.setTimeout(() => setDiscoverySnapTipId((id) => (id === detail.id ? null : id)), 950)
      setVmSyncStamp(Date.now())
      /* Birth on grid only (atomic assembly) — user opens discovery in Solo Focus when ready. */
      if (!isAchievement && detail.id && !readVisitedCardIds().has(detail.id)) {
        void fetch('/api/zone/tips-refresh', { method: 'POST', credentials: 'include' }).catch(() => {})
        setRefreshKey((k) => k + 1)
      }
    }
    window.addEventListener(DISCOVERY_INJECT_EVENT, onInject)
    return () => window.removeEventListener(DISCOVERY_INJECT_EVENT, onInject)
  }, [closeSoloFocus, openSoloFocus])

  useEffect(() => {
    const onAnswerCommitted = (e: Event) => {
      const d = (e as CustomEvent<{ journeyId?: string }>).detail
      if (d?.journeyId) {
        setInsightPendingKeys((s) => new Set(s).add(String(d.journeyId).toLowerCase()))
      }
      setVmSyncStamp(Date.now())
      setRefreshKey((k) => k + 1)
    }
    window.addEventListener(ANSWER_COMMITTED_EVENT, onAnswerCommitted as EventListener)
    return () => window.removeEventListener(ANSWER_COMMITTED_EVENT, onAnswerCommitted as EventListener)
  }, [])

  useEffect(() => {
    if (effectiveInjectedTips.length === 0) {
      setTipDataPatches({})
      return
    }
    const ids = effectiveInjectedTips.map((t) => t.id)
    let cancelled = false
    runDiscoveryPulse(ids).then((pulse) => {
      if (cancelled || !pulse) return
      const prev = readStoredEconomyFingerprint()
      if (prev !== pulse.fingerprint) {
        writeStoredEconomyFingerprint(pulse.fingerprint)
        setTipDataPatches(pulse.patches)
      } else {
        setTipDataPatches({})
      }
    })
    return () => {
      cancelled = true
    }
  }, [effectiveInjectedTips])

  useEffect(() => {
    if (!hydrated) return
    const storedCompleted = safeGetJson<JourneyId[]>('completedJourneys', [])
    setCompletedJourneys(storedCompleted)
    setUnlockedCount((prev) => {
      const derived = Math.min(12, Math.max(3, 3 + storedCompleted.length))
      return Math.max(prev, derived)
    })
    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      const stored = safeGetItem(`journey_${journeyId}_answers`)
      if (stored) {
        try {
          journeyAnswers[journeyId] = JSON.parse(stored)
        } catch {
          journeyAnswers[journeyId] = {}
        }
      }
    })
    const profileFromStorage = readProfileFieldsFromStorage()
    const profile = {
      ...profileFromStorage,
      name: state.profile?.name ?? profileFromStorage.name,
      postcode:
        liveProfilePostcode ||
        state.profile?.postcode ||
        profileFromStorage.postcode ||
        scrapePostcode,
      household: state.profile?.livingSituation ?? profileFromStorage.household,
      home_type: state.profile?.homeType ?? profileFromStorage.home_type,
      home_power: state.profile?.homePower ?? profileFromStorage.home_power,
      transport_baseline: state.profile?.transport ?? profileFromStorage.transport_baseline,
      age: state.profile?.age ?? profileFromStorage.age,
      employment_status:
        state.profile?.employmentStatus?.trim() || profileFromStorage.employment_status,
      goal: state.profile?.goal?.trim() || profileFromStorage.goal,
      household_income_bracket: profileFromStorage.household_income_bracket,
    }
    const hasResearchFeed =
      scraped != null ||
      (researchCategoryCoverage != null && Object.keys(researchCategoryCoverage).length > 0) ||
      liveResearchData ||
      Boolean(researchMeta?.architectProse?.trim()) ||
      (researchMeta?.savingAmountGbp != null && researchMeta.savingAmountGbp > 0) ||
      (researchMeta?.verifiedSaving != null && researchMeta.verifiedSaving > 0)

    const effectiveMarket = {
      ...(marketContext ?? {}),
      ...(homeUnitRates ? { homeUnitRates } : {}),
      ...(researchMeta?.verifiedSaving != null ? { verifiedSaving: researchMeta.verifiedSaving } : {}),
      ...(researchMeta?.savingAmountGbp != null ? { savingAmountGbp: researchMeta.savingAmountGbp } : {}),
      ...(liveResearchData ? { liveResearchData: true as const } : {}),
    }
    const vm = buildZoneViewModel({
      profile: {
        name: profile.name,
        postcode: profile.postcode,
        household: profile.household,
        home_type: profile.home_type,
        home_power: profile.home_power,
        transport_baseline: profile.transport_baseline,
        age: profile.age,
        employment_status: profile.employment_status,
        goal: profile.goal,
        household_income_bracket: profile.household_income_bracket,
      },
      journeyAnswers,
      scraped: scraped ? Object.fromEntries(
        Object.entries(scraped).map(([k, v]) => [
          k,
          { journey_key: k as JourneyId, scraped_at: v.scraped_at, carbon_value: v.carbon_value, money_value: v.money_value, deep_content_tip: v.deep_content_tip, high_saving: v.high_saving },
        ])
      ) : undefined,
      localData: localData
        ? {
            council: localData.council,
            localCarbonG: localData.localCarbonG,
            heat_pump_grant_context: localData.heat_pump_grant_context,
          }
        : undefined,
      injectedTips: effectiveInjectedTips,
      marketContext: Object.keys(effectiveMarket).length > 0 ? effectiveMarket : undefined,
      neonJourneyResearch: neonJourneyResearchFromCoverage(researchCategoryCoverage),
      categoryIntentWeights,
    })
    setViewModel(vm)
    setVmSyncStamp(Date.now())
    let cancelled = false
    const postcode = (
      liveProfilePostcode ||
      state.profile?.postcode ||
      profileFromStorage.postcode ||
      ''
    )
      .replace(/\s+/g, '')
      .trim()

    void (async () => {
      const pr = postcode.length >= 4 ? postcode : scrapePostcode
      const pulse = await fetchLivingPulseSnapshot(pr, localData)
      if (cancelled) return
      const nextMarketContext = {
        liveProfilePostcode: postcode || undefined,
        april2026PriceCapGbp: pulse.priceCapGbp,
        regionalGridIntensityGPerKwh: pulse.regionalCarbonGPerKwh,
        liveResearchData,
        deepLink: researchMeta?.deepLink,
        verifiedSaving: researchMeta?.verifiedSaving,
        savingAmountGbp: researchMeta?.savingAmountGbp,
        localityContext: researchMeta?.localityContext ?? localData?.locality ?? localData?.council,
        ...(homeUnitRates ? { homeUnitRates } : {}),
      }
      setMarketContext(nextMarketContext)

      const vmLive = buildZoneViewModel({
        profile: {
          name: profile.name,
          postcode: profile.postcode,
          household: profile.household,
          home_type: profile.home_type,
          transport_baseline: profile.transport_baseline,
          age: profile.age,
          employment_status: profile.employment_status,
          goal: profile.goal,
          household_income_bracket: profile.household_income_bracket,
        },
        journeyAnswers,
        scraped: scraped
          ? Object.fromEntries(
              Object.entries(scraped).map(([k, v]) => [
                k,
                {
                  journey_key: k as JourneyId,
                  scraped_at: v.scraped_at,
                  carbon_value: v.carbon_value,
                  money_value: v.money_value,
                  deep_content_tip: v.deep_content_tip,
                  high_saving: v.high_saving,
                },
              ])
            )
          : undefined,
        localData: localData
          ? {
              council: localData.council,
              localCarbonG: localData.localCarbonG,
              heat_pump_grant_context: localData.heat_pump_grant_context,
            }
          : undefined,
        injectedTips: effectiveInjectedTips,
        marketContext: nextMarketContext,
        neonJourneyResearch: neonJourneyResearchFromCoverage(researchCategoryCoverage),
        categoryIntentWeights,
      })

      const gridTotals = sumJourneyGridTotals(vmLive)
      const liveSavings = gridTotals.totalMoney
      const liveCarbon = gridTotals.totalCarbon

      if (dbConnected) {
        setHeroTotals({
          totalMoney: liveSavings,
          totalCarbon: liveCarbon,
        })
      }
      setHeroLiveGrounded(pulse.source === 'live')
      if (pulse.source === 'live') {
        setSentinelPulseLabel('Active | Data: Live April 2026')
        window.setTimeout(() => setSentinelPulseLabel(null), 1800)
      }

      if (hasResearchFeed) {
        setViewModel(
          dbConnected
            ? vmLive
            : {
                ...vmLive,
                hero: {
                  ...vmLive.hero,
                  title: 'connect',
                  data: {
                    money: '£0',
                    carbon: '0kg CO₂',
                  },
                },
              }
        )
        setVmSyncStamp(Date.now())
      }
    })()

    return () => {
      cancelled = true
    }
    // marketContext is written by the async path in this effect; listing it would re-fire after setMarketContext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.profile,
    liveProfilePostcode,
    scraped,
    localData,
    refreshKey,
    effectiveInjectedTips,
    setHeroTotals,
    liveResearchData,
    dbConnected,
    researchMeta,
    homeUnitRates,
    researchCategoryCoverage,
    categoryIntentWeights,
    hydrated,
    scrapePostcode,
  ])

  /** Content Architect (Gemini): enrich nine category cards — cached per profile + answers + £/kg. */
  useEffect(() => {
    if (!hydrated) return

    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      const stored = safeGetItem(`journey_${journeyId}_answers`)
      if (stored) {
        try {
          journeyAnswers[journeyId] = JSON.parse(stored)
        } catch {
          journeyAnswers[journeyId] = {}
        }
      }
    })
    const profileFromStorage = readProfileFieldsFromStorage()
    const profile = {
      ...profileFromStorage,
      name: state.profile?.name ?? profileFromStorage.name,
      postcode:
        liveProfilePostcode ||
        state.profile?.postcode ||
        profileFromStorage.postcode ||
        scrapePostcode,
      household: state.profile?.livingSituation ?? profileFromStorage.household,
      home_type: state.profile?.homeType ?? profileFromStorage.home_type,
      home_power: state.profile?.homePower ?? profileFromStorage.home_power,
      transport_baseline: state.profile?.transport ?? profileFromStorage.transport_baseline,
      age: state.profile?.age ?? profileFromStorage.age,
      employment_status:
        state.profile?.employmentStatus?.trim() || profileFromStorage.employment_status,
      goal: state.profile?.goal?.trim() || profileFromStorage.goal,
      household_income_bracket: profileFromStorage.household_income_bracket,
    }

    const effectiveMarketArchitect = {
      ...(marketContext ?? {}),
      ...(homeUnitRates ? { homeUnitRates } : {}),
      ...(researchMeta?.verifiedSaving != null ? { verifiedSaving: researchMeta.verifiedSaving } : {}),
      ...(researchMeta?.savingAmountGbp != null ? { savingAmountGbp: researchMeta.savingAmountGbp } : {}),
      ...(liveResearchData ? { liveResearchData: true as const } : {}),
    }
    const vm = buildZoneViewModel({
      profile: {
        name: profile.name,
        postcode: profile.postcode,
        household: profile.household,
        home_type: profile.home_type,
        home_power: profile.home_power,
        transport_baseline: profile.transport_baseline,
        age: profile.age,
        employment_status: profile.employment_status,
        goal: profile.goal,
        household_income_bracket: profile.household_income_bracket,
      },
      journeyAnswers,
      scraped: scraped
        ? Object.fromEntries(
            Object.entries(scraped).map(([k, v]) => [
              k,
              {
                journey_key: k as JourneyId,
                scraped_at: v.scraped_at,
                carbon_value: v.carbon_value,
                money_value: v.money_value,
                deep_content_tip: v.deep_content_tip,
                high_saving: v.high_saving,
              },
            ])
          )
        : undefined,
      localData: localData ? { council: localData.council, localCarbonG: localData.localCarbonG } : undefined,
      injectedTips: effectiveInjectedTips,
      marketContext:
        Object.keys(effectiveMarketArchitect).length > 0 ? effectiveMarketArchitect : undefined,
      neonJourneyResearch: neonJourneyResearchFromCoverage(researchCategoryCoverage),
      categoryIntentWeights,
    })

    const nine = vm.journeys.filter((j) => j.id.startsWith('journey-'))
    const cachePayload = {
      pc: profile.postcode ?? '',
      answers: JOURNEY_ORDER.reduce(
        (acc, k) => {
          acc[k] = journeyAnswers[k] ?? {}
          return acc
        },
        {} as Record<JourneyId, Record<string, string>>
      ),
      grid: nine.map((j) => [j.journey_key, Math.round(j.moneyGbp ?? 0), Math.round(j.carbonKg ?? 0)] as const),
      rates: homeUnitRates
        ? [homeUnitRates.elecGbpPerKwh, homeUnitRates.gasGbpPerKwh, ratesSourceUrl ?? '']
        : null,
    }
    const cacheKey = `zz_architect_${architectCacheFingerprint(cachePayload)}`
    if (architectBatchKeyRef.current === cacheKey) {
      return
    }
    architectBatchKeyRef.current = cacheKey
    const skip = new Set<JourneyId>()
    if ((profile.postcode ?? '').replace(/\s+/g, '').toUpperCase().startsWith('KW')) {
      skip.add('home')
    }

    let cancelled = false
    const apply = (
      by: Partial<Record<JourneyId, ArchitectJourneyPayload>>,
      resolvedLinks?: Partial<Record<JourneyId, string>>,
    ) => {
      if (cancelled) return
      setViewModel((prev) =>
        applyArchitectEnrichment(prev, by, { skipJourneys: skip, claimUrls: resolvedLinks }),
      )
      setVmSyncStamp(Date.now())
    }

    try {
      const hit = sessionStorage.getItem(cacheKey)
      if (hit) {
        const parsed = JSON.parse(hit) as
          | Partial<Record<JourneyId, ArchitectJourneyPayload>>
          | { byJourney?: Partial<Record<JourneyId, ArchitectJourneyPayload>>; resolvedLinks?: Partial<Record<JourneyId, string>> }
        if (parsed && typeof parsed === 'object' && 'byJourney' in parsed) {
          apply((parsed as { byJourney?: Partial<Record<JourneyId, ArchitectJourneyPayload>> }).byJourney ?? {}, (parsed as { resolvedLinks?: Partial<Record<JourneyId, string>> }).resolvedLinks)
        } else {
          apply(parsed as Partial<Record<JourneyId, ArchitectJourneyPayload>>)
        }
        return () => {
          cancelled = true
        }
      }
    } catch {
      /* ignore bad cache */
    }

    const cards = buildContentArchitectCardPayload({
      vm,
      journeyAnswers,
      localCouncil: localData?.council,
      localGridGPerKwh: localData?.localCarbonG,
      liveUnitRates: homeUnitRates ?? undefined,
      ratesCitationUrl: ratesSourceUrl ?? undefined,
      marketResearch: {
        deepLinkUrl: marketContext?.deepLink,
        verifiedSavingValue: marketContext?.verifiedSaving,
      },
      profile: {
        home_type: profile.home_type,
        age: profile.age,
        household_size: inferHouseholdSize(profile.household),
        postcode: profile.postcode,
      },
    })

    void (async () => {
      try {
        const res = await fetch('/api/zone/content-architect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards }),
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          byJourney?: Partial<Record<JourneyId, ArchitectJourneyPayload>>
          resolvedLinks?: Partial<Record<JourneyId, string>>
        }
        const by = data.byJourney ?? {}
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ byJourney: by, resolvedLinks: data.resolvedLinks }))
        } catch {
          /* quota */
        }
        apply(by, data.resolvedLinks)
      } catch {
        /* offline / API */
      }
    })()

    return () => {
      cancelled = true
    }
    // Intentionally omit refreshKey / discovery tips — one architect batch per cacheKey only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- credit guard
  }, [
    state.profile,
    liveProfilePostcode,
    homeUnitRates,
    ratesSourceUrl,
    researchCategoryCoverage,
    hydrated,
    scrapePostcode,
  ])

  const { achievementTips, discoveryTips, baselineTips } = useMemo(() => {
    const achievements: ZoneTipCard[] = [...pinnedAchievements]
    const discovery: ZoneTipCard[] = []
    const onGrid = new Set<string>()
    for (const tip of effectiveInjectedTips) {
      if (tip.achievement_discovery && !achievements.some((a) => a.id === tip.id)) {
        achievements.push(tip)
        onGrid.add(tip.id)
      } else if (isUserDiscoveryInjectTip(tip)) {
        discovery.push(tip)
        onGrid.add(tip.id)
      }
    }
    const baseline: ZoneTipCard[] = []
    for (const tip of viewModel.tips) {
      if (onGrid.has(tip.id)) continue
      if (tip.id.startsWith('inject-')) continue
      if (tip.achievement_discovery) continue
      baseline.push(tip)
    }
    return {
      achievementTips: achievements,
      discoveryTips: capDiscoveryTipsForGrid(discovery),
      baselineTips: dedupeZoneTipCards(baseline),
    }
  }, [pinnedAchievements, effectiveInjectedTips, viewModel.tips])

  const isZoneCardVisited = useCallback(
    (cardId: string, journeyKey?: JourneyId) =>
      isZoneCardPink(cardId, visitedCardIds, dbVisitedJourneyKeys, journeyKey),
    [visitedCardIds, dbVisitedJourneyKeys]
  )
  const [deepDivePendingId, setDeepDivePendingId] = useState<string | null>(() =>
    readDeepDiveInProgressCardId()
  )
  useEffect(() => {
    const syncVisited = () => setVisitedCardIds(readVisitedCardIds())
    const syncDeepDive = () => setDeepDivePendingId(readDeepDiveInProgressCardId())
    syncVisited()
    syncDeepDive()
    window.addEventListener('zz-visited-cards-changed', syncVisited)
    window.addEventListener('zz-deep-dive-progress-changed', syncDeepDive)
    return () => {
      window.removeEventListener('zz-visited-cards-changed', syncVisited)
      window.removeEventListener('zz-deep-dive-progress-changed', syncDeepDive)
    }
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setDeepDiveInProgress(null)
        setDeepDivePendingId(readDeepDiveInProgressCardId())
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const sessionRestoreDone = useRef(false)

  const groovyItems = useMemo(
    () =>
      buildGroovyGridItems({
        viewModel,
        achievementTips,
        discoveryTips,
        baselineTips,
        personaForJourney: (jid) => JOURNEY_BENTO_PERSONA[jid],
        profileGoal: state.profile?.goal,
        profile: {
          home_power: state.profile?.homePower,
          homePower: state.profile?.homePower,
        },
      }),
    [
      viewModel,
      achievementTips,
      discoveryTips,
      baselineTips,
      state.profile?.goal,
      state.profile?.homePower,
    ]
  )
  const displayItems: GroovyItem[] = useMemo(() => [...groovyItems], [groovyItems])

  useEffect(() => {
    if (!hydrated || sessionRestoreDone.current || displayItems.length === 0) return
    const mem = readSessionMemory()
    const focus = mem?.last_solo_focus
    if (!focus?.cardId) return
    const journeyCell = displayItems.find(
      (c): c is GroovyItem & { type: 'journey' } => c.type === 'journey' && c.item.id === focus.cardId
    )
    const tipCell = displayItems.find(
      (c): c is GroovyItem & { type: 'tip' } => c.type === 'tip' && c.tip.id === focus.cardId
    )
    sessionRestoreDone.current = true
    if (journeyCell) {
      if (openSoloFocus(journeyCell.item.id, 'journey')) {
        setExpandedCardId(journeyCell.item.id)
        setExpandedFromTip(null)
        setExpandedTipId(null)
      }
      return
    }
    if (tipCell) {
      if (tipCell.tip.id.startsWith('inject-')) {
        if (openSoloFocus(tipCell.tip.id, 'discovery')) {
          setExpandedCardId(null)
          setExpandedFromTip(null)
          setExpandedTipId(tipCell.tip.id)
        }
      } else if (openSoloFocus(tipCell.tip.id, 'tip')) {
        setExpandedCardId(null)
        setExpandedFromTip(null)
        setExpandedTipId(tipCell.tip.id)
      }
    }
  }, [hydrated, displayItems, openSoloFocus])

  const zoneHandoffStaging = architecturalPulsePhase === 'pulse'

  const researchLoading = !vmResolved
  const isZoneReady = useMemo(
    () => computeIsZoneReady({ hydrated, vmResolved, scrapePostcode }),
    [hydrated, vmResolved, scrapePostcode]
  )

  const beginZonePunchThrough = useCallback(() => {
    if (architecturalPulsePhaseRef.current !== 'pulse') return
    setArchitecturalPulsePhase('punch')
    window.setTimeout(() => {
      setArchitecturalPulsePhase('done')
    }, 480)
  }, [])

  useEffect(() => {
    if (architecturalPulsePhase !== 'pulse' || !isZoneReady || !pulseWordsComplete) return
    beginZonePunchThrough()
  }, [architecturalPulsePhase, isZoneReady, pulseWordsComplete, beginZonePunchThrough])

  /** Scrape-ready fallback — never skip Architectural Pulse words (Director's order). */
  useEffect(() => {
    if (architecturalPulsePhase !== 'pulse' || isZoneReady) return
    const safety = window.setTimeout(() => {
      if (architecturalPulsePhaseRef.current !== 'pulse') return
      setVmResolved(true)
    }, ZONE_READY_MAX_WAIT_MS)
    return () => window.clearTimeout(safety)
  }, [architecturalPulsePhase, isZoneReady])

  /** Return visits / deep links: no summary handoff — grid may reveal once wall is idle. */
  useLayoutEffect(() => {
    if (zoneHandoffStaging) return
    if (architecturalPulsePhase === 'done') {
      setPulseWordsComplete(true)
      if (displayItems.length > 0) {
        setRevealedCardCount((n) => Math.max(n, 1))
      }
    }
  }, [zoneHandoffStaging, architecturalPulsePhase, displayItems.length])

  useEffect(() => {
    if (zoneHandoffStaging) return
    if (architecturalPulsePhase === 'done' && !pulseWordsComplete) {
      setPulseWordsComplete(true)
    }
  }, [zoneHandoffStaging, architecturalPulsePhase, pulseWordsComplete])

  /** Never leave summary handoff pulse stuck if scrape-sync is slow. */
  useEffect(() => {
    if (architecturalPulsePhase !== 'pulse') return
    const t = window.setTimeout(() => {
      if (architecturalPulsePhaseRef.current !== 'pulse') return
      setPulseWordsComplete(true)
      setArchitecturalPulsePhase('done')
    }, ZONE_READY_MAX_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [architecturalPulsePhase])

  /** Last-resort grid reveal — hero visible but bento collapsed. */
  useEffect(() => {
    if (!hydrated || zoneHandoffStaging || architecturalPulsePhase !== 'done') return
    const t = window.setTimeout(() => {
      setPulseWordsComplete(true)
      if (displayItems.length > 0) {
        setRevealedCardCount((n) => Math.max(n, 1))
      }
    }, 4_000)
    return () => window.clearTimeout(t)
  }, [hydrated, zoneHandoffStaging, architecturalPulsePhase, displayItems.length])

  const zoneInteractable =
    isZoneVisible &&
    hydrated &&
    architecturalPulsePhase === 'done' &&
    !patternShiftJourneyId
  const zoneWallCollapsed =
    zoneHandoffStaging ||
    architecturalPulsePhase !== 'done' ||
    !pulseWordsComplete
  const showInlineLoadingLogo = architecturalPulsePhase === 'glitch'
  const zoneRevealCount = Math.min(revealedCardCount, displayItems.length)
  const gridFullyRevealed =
    architecturalPulsePhase === 'done' &&
    pulseWordsComplete &&
    displayItems.length > 0 &&
    zoneRevealCount >= displayItems.length

  const openZoneJourneySoloFocus = useCallback(
    (item: ZoneJourneyCard, fromTip?: ZoneTipCard | null) => {
      if (!zoneInteractable) return
      soloFocusExpandIntentRef.current = item.id
      setExpandedTipId(null)
      setExpandedFromTip(fromTip ?? null)
      setExpandedCardId(item.id)
      setExpandCard(
        {
          id: item.id,
          title:
            fromTip?.title ??
            (item.journey_key === 'home' && homeSentinelSupportActive
              ? homeSupportTitle
              : item.title),
          journey_key: item.journey_key,
          data: fromTip?.data ?? item.data,
          explanation: fromTip?.explanation ?? item.explanation,
          localCouncilTip: item.localCouncilTip,
          source: fromTip?.source ?? item.source,
          sourceLabel: fromTip?.sourceLabel ?? item.sourceLabel,
          actions:
            item.journey_key === 'home' && homeSentinelSupportActive
              ? { ...(item.actions ?? {}), actionUrl: homeSupportOfferUrl, learnUrl: homeSupportOfferUrl }
              : fromTip?.actions ?? item.actions,
        },
        'zone'
      )
      rememberSoloFocusOpen(item.id, item.journey_key)
      openSoloFocus(item.id, 'journey')
    },
    [
      zoneInteractable,
      homeSentinelSupportActive,
      homeSupportTitle,
      homeSupportOfferUrl,
      openSoloFocus,
    ]
  )

  useEffect(() => {
    const pinFloor = 1 + pinnedAchievements.length
    const showPinnedWhileLoading = pinnedAchievements.length > 0 && isZoneVisible && architecturalPulsePhase === 'done'

    if (!isZoneVisible || architecturalPulsePhase !== 'done' || !pulseWordsComplete) {
      if (architecturalPulsePhase !== 'done') {
        setRevealedCardCount(0)
      }
      return
    }
    if (displayItems.length === 0) return
    setRevealedCardCount((n) => Math.max(n, pinFloor, 1))
    let n = Math.max(pinFloor, 1)
    const stepMs = Math.max(72, ZONE_GRID_STAGGER_CHILD_DELAY_SEC * 1000 * 2)
    const id = window.setInterval(() => {
      n += 1
      setRevealedCardCount(n)
      if (n >= displayItems.length) window.clearInterval(id)
    }, stepMs)
    return () => window.clearInterval(id)
  }, [
    isZoneVisible,
    architecturalPulsePhase,
    displayItems.length,
    cleanBirthRevealKey,
    summaryGridStaggerKey,
    pinnedAchievements.length,
    pulseWordsComplete,
  ])

  const rockOfferByJourney = useMemo(() => {
    const out: Partial<Record<JourneyId, string>> = {}
    const cov = researchCategoryCoverage
    if (!cov) return out
    for (const jid of JOURNEY_ORDER) {
      const row = cov[jid]
      const url = row?.latestOfferUrl?.trim() || row?.latestSourceUrl?.trim()
      if (url?.startsWith('https://')) out[jid] = url
    }
    return out
  }, [researchCategoryCoverage])

  const rockHabitsWithOffers = useMemo(() => {
    const capped = capRockHabitsPerJourney(rockVisibleHabits).slice(0, MAX_ROCK_SAVING_TIPS_RAIL)
    return capped.map((h) => {
      const url = rockOfferByJourney[h.journey_key]
      return url ? { ...h, learn_url: url } : h
    })
  }, [rockVisibleHabits, rockOfferByJourney])

  const openNextJourneyFromExpanded = useCallback(
    (jid: JourneyId) => {
      const idx = JOURNEY_ORDER.indexOf(jid)
      for (let step = idx + 1; step < JOURNEY_ORDER.length; step++) {
        const nextKey = JOURNEY_ORDER[step]
        for (const c of displayItems) {
          if (c.type === 'journey' && c.item.journey_key === nextKey) {
            openZoneJourneySoloFocus(c.item)
            return
          }
        }
      }
    },
    [displayItems, openZoneJourneySoloFocus],
  )

  /** Oversized slot-machine numbers: strict journey-sum totals + liked Rock habits. */
  const neonVerifiedMoney = useMemo(() => {
    const fromCov =
      researchCategoryCoverage &&
      Object.values(researchCategoryCoverage).some(
        (c) =>
          (c.latestSavingGbp != null && c.latestSavingGbp > 0) ||
          (c.latestVerifiedGbp != null && c.latestVerifiedGbp > 0)
      )
    return (
      Boolean(fromCov) ||
      (researchMeta?.verifiedSaving != null && researchMeta.verifiedSaving > 0) ||
      (researchMeta?.savingAmountGbp != null && researchMeta.savingAmountGbp > 0)
    )
  }, [
    researchCategoryCoverage,
    researchMeta?.verifiedSaving,
    researchMeta?.savingAmountGbp,
  ])
  const heroWasteTotals = useMemo(
    () => (viewModel ? sumJourneyGridTotals(viewModel) : { totalMoney: 0, totalCarbon: 0 }),
    [viewModel]
  )
  const rockLikedImpact = sumRockLikedImpact(state.likedCards)
  /** Profile hero card — waste £/kg summed from journey bento tiles (same as category cards). */
  const heroMoney = heroWasteTotals.totalMoney + rockLikedImpact.money
  const heroCarbon = heroWasteTotals.totalCarbon + rockLikedImpact.carbon
  /** Welcome masthead — sum of £/kg on visible journey + tip bento cells. */
  const zoneGridSavings = useMemo(() => {
    let totalMoney = 0
    let totalCarbon = 0
    for (const cell of displayItems) {
      if (cell.type === 'journey') {
        totalMoney += Math.max(
          0,
          Number(cell.item.moneyGbp ?? parseMoneyGbpFromDisplay(cell.item.data?.money ?? '0'))
        )
        totalCarbon += Math.max(
          0,
          Number(cell.item.carbonKg ?? parseCarbonKgFromDisplay(cell.item.data?.carbon ?? '0'))
        )
      } else if (cell.type === 'tip') {
        totalMoney += parseMoneyGbpFromDisplay(cell.tip.data?.money ?? '0')
        totalCarbon += parseCarbonKgFromDisplay(cell.tip.data?.carbon ?? '0')
      }
    }
    return { totalMoney, totalCarbon }
  }, [displayItems])
  const welcomeJourneyCount = useMemo(() => {
    const fromStorage = completedJourneys.length
    const fromCards = viewModel.journeys.filter((j) => {
      if (!j.id.startsWith('journey-')) return false
      const m = Number(j.moneyGbp ?? parseMoneyGbpFromDisplay(j.data?.money ?? '0'))
      const c = Number(j.carbonKg ?? parseCarbonKgFromDisplay(j.data?.carbon ?? '0'))
      return m > 0 || c > 0
    }).length
    return Math.max(fromStorage, fromCards)
  }, [completedJourneys.length, viewModel.journeys])
  const displayMoney = useCountUp(heroMoney, { duration: 120 })
  const displayCarbon = useCountUp(heroCarbon, { duration: 120 })
  const heroDataSource = dbConnected && neonVerifiedMoney ? 'VERIFIED AUDIT' : 'ESTIMATED AUDIT'

  const zoneWelcome = useMemo(
    () =>
      buildZoneWelcomeCopy(
        state?.profile?.name,
        welcomeJourneyCount,
        zoneGridSavings.totalMoney,
        zoneGridSavings.totalCarbon
      ),
    [state?.profile?.name, welcomeJourneyCount, zoneGridSavings.totalMoney, zoneGridSavings.totalCarbon]
  )

  return (
    <LayoutGroup>
      <motion.main
        className="zone relative min-h-screen overflow-x-hidden pb-[calc(11rem+env(safe-area-inset-bottom,0px))]"
        style={{
          color: 'var(--color-yellow)',
          boxShadow: 'none',
        }}
        {...FADE_IN_UP}
      >
        {zoneHandoffStaging ? (
          <div
            className="zone-handoff-overlay"
            role="status"
            aria-live="polite"
            aria-label="Preparing your savings wall"
          >
            <ArchitecturalPulse inline onComplete={() => setPulseWordsComplete(true)} />
          </div>
        ) : null}
        {/* Zone wall — hero, bento, Rock share one rail so copy + cards + signup align */}
        {isZoneVisible && !zoneHandoffStaging ? (
        <div className="zone-wall-stack zone-content-rail w-full flex flex-col items-stretch box-border">
        <motion.div
          className={`zone-anchor flex flex-col pt-0 pb-0 w-full${
            zoneHandoffStaging || showInlineLoadingLogo ? ' zone-anchor--wall-loading' : ' items-start'
          }`}
          aria-hidden={false}
          variants={STACCATO_CONTAINER_VARIANTS}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={STACCATO_CHILD_VARIANTS}
            className="zone-hero-grid w-full"
            aria-live="polite"
          >
            <div className="zone-hero-copy">
              <motion.h2
                className="zz-h2 zone-welcome zone-welcome-block zone-welcome-name m-0"
                style={{ color: 'var(--color-yellow)' }}
                variants={STACCATO_CHILD_VARIANTS}
                initial="hidden"
                animate="visible"
              >
                {zoneWelcome.nameLine}
              </motion.h2>
              <motion.h2
                className="zz-h2 zone-welcome zone-welcome-block zone-welcome-savings m-0"
                style={{ color: 'var(--color-yellow)' }}
                variants={STACCATO_CHILD_VARIANTS}
                initial="hidden"
                animate="visible"
              >
                {zoneWelcome.savingsLeadLine}
              </motion.h2>
              <motion.h2
                className="zz-h2 zone-welcome zone-welcome-block zone-welcome-savings m-0"
                style={{ color: 'var(--color-yellow)' }}
                variants={STACCATO_CHILD_VARIANTS}
                initial="hidden"
                animate="visible"
              >
                {zoneWelcome.savingsMoneyLine}
              </motion.h2>
              <motion.h2
                className="zz-h2 zone-welcome zone-welcome-block zone-welcome-savings m-0"
                style={{ color: 'var(--color-yellow)' }}
                variants={STACCATO_CHILD_VARIANTS}
                initial="hidden"
                animate="visible"
              >
                {zoneWelcome.savingsCarbonLine}
              </motion.h2>
            </div>
            <ZoneDesktopNavRail />
          </motion.div>
          {showInlineLoadingLogo && !zoneHandoffStaging ? (
            <motion.div
              variants={STACCATO_CHILD_VARIANTS}
              initial="hidden"
              animate="visible"
              className="zone-inline-loading-logo"
              role="status"
              aria-live="polite"
              aria-label="Loading your savings wall"
            >
              <AtomicLogo loop width={100} />
            </motion.div>
          ) : null}
          {sentinelPulseLabel ? (
            <motion.p
              key={sentinelPulseLabel}
              className="zz-body-bold m-0 mt-2 uppercase"
              initial={FAMILY_ATOMIC_SURFACE_INITIAL}
              animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
              exit={FAMILY_ATOMIC_SURFACE_EXIT}
              transition={FAMILY_TRANSITION_ATOMIC}
              style={{ color: 'var(--color-yellow)' }}
            >
              {sentinelPulseLabel}
            </motion.p>
          ) : null}
        </motion.div>

        {/* 2. BENTO WALL — hidden until first card hydrates; then cards reveal one-by-one */}
        <motion.div
          className={[
            'zone-container',
            zoneHandoffStaging && !patternShiftJourneyId
              ? 'zone-container--pulse-prerender'
              : '',
            zoneWallCollapsed ? 'zone-container--wall-collapsed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={zoneWallCollapsed}
        >
          <LayoutGroup id="zone-bento-wall">
          <motion.div
            key={`zone-grid-${summaryGridStaggerKey}-${cleanBirthRevealKey}`}
            data-testid="zone-grid-mounted"
            {...(architecturalPulsePhase === 'punch'
              ? {
                  initial: ZONE_GRID_PUNCH_THROUGH.initial,
                  animate: ZONE_GRID_PUNCH_THROUGH.animate,
                  transition: ZONE_GRID_PUNCH_THROUGH.transition,
                  style: { transformOrigin: 'center center' },
                }
              : cleanBirthRevealKey > 0
                ? {
                    initial: ZONE_GRID_PUNCH_THROUGH.initial,
                    animate: ZONE_GRID_PUNCH_THROUGH.animate,
                    transition: ZONE_GRID_PUNCH_THROUGH.transition,
                    style: { transformOrigin: 'center center' },
                  }
                : architecturalPulsePhase === 'done' && summaryGridStaggerKey > 0
                  ? {}
                  : {})}
            data-profile-postcode={scrapePostcode}
            data-vm-sync={String(vmSyncStamp)}
            data-research-loading={researchLoading ? '1' : '0'}
            className={`groovy-zone-grid mx-auto${zoneWallCollapsed ? '' : ' groovy-zone-grid--revealing'} ${localJustLoaded ? 'zone-grid-local-shiver' : ''}`}
            variants={{
              initial: {},
              animate: {
                transition: {
                  staggerChildren: ZONE_GRID_STAGGER_CHILD_DELAY_SEC,
                  delayChildren: ZONE_GRID_STAGGER_CHILD_DELAY_SEC,
                },
              },
            }}
            initial="initial"
            animate="animate"
          >
            {displayItems.map((cell, i) => {
              if (i >= zoneRevealCount) return null
              const cellKey =
                cell.type === 'hero' ? 'hero' : cell.type === 'tip' ? cell.tip.id : cell.item.id
              const isExpanded = cell.type === 'journey' && expandedCardId === cell.item.id
              const spanClass =
                cell.type === 'hero'
                  ? 'bento-hero-span'
                  : cell.type === 'tip'
                    ? ''
                    : cell.type === 'journey'
                      ? bentoSpanClassForPersona(cell.persona)
                      : ''
              /* Hide other cells when a journey/tip card is expanded */
              const isHidden =
                (!!expandedCardId && !(cell.type === 'journey' && cell.item.id === expandedCardId)) ||
                (!!expandedTipId && !(cell.type === 'tip' && cell.tip.id === expandedTipId))
              const skeletonCell =
                researchLoading && (cell.type === 'hero' || cell.type === 'journey')

              return (
                <motion.div
                  key={cellKey}
                  variants={ZONE_BENTO_CELL_VARIANTS}
                  initial="hidden"
                  animate={
                    isHidden
                      ? 'shrunk'
                      : cell.type === 'journey' &&
                          (sentinelPingJourneyKeys[cell.item.journey_key] ||
                            (sentinel.gridLowPulse && cell.item.journey_key === 'carbon'))
                        ? 'ping'
                        : 'visible'
                  }
                  className={`${spanClass} groovy-cell-radius h-full min-h-0${cell.type === 'hero' ? ' zone-hero-cell' : ''}${skeletonCell ? ' zone-bento-skeleton' : ''}`.trim() || 'groovy-cell-radius'}
                  style={{
                    willChange: 'transform',
                    pointerEvents: zoneInteractable && !isHidden ? 'auto' : 'none',
                  }}
                >
                  {cell.type === 'hero' && (
                    <motion.div
                      className="relative flex flex-col items-stretch w-full flex-1 min-h-0 h-full text-left"
                      style={{ transformOrigin: 'center center' }}
                      {...(heroFromSummaryHandoff
                        ? {
                            initial: ZONE_HERO_FROM_SUMMARY.initial,
                            animate: ZONE_HERO_FROM_SUMMARY.animate,
                            transition: ZONE_HERO_FROM_SUMMARY.transition,
                            onAnimationComplete: () => setHeroFromSummaryHandoff(false),
                          }
                        : {})}
                    >
                      <div className="w-full flex-1 min-h-0 flex flex-col pt-5">
                        <Link
                          href={ROUTES.SETTINGS}
                          data-testid="zone-hero-card"
                          data-source={heroDataSource}
                          tabIndex={zoneInteractable ? 0 : -1}
                          aria-disabled={!zoneInteractable}
                          onClick={(e) => {
                            if (!zoneInteractable) e.preventDefault()
                          }}
                          className={`zone-hero-card bento-card-groovy flex flex-col flex-1 min-h-0 h-full w-full justify-between cursor-pointer no-underline text-inherit${sentinelHeroPing ? ' sentinel-hero-ping' : ''}`}
                          style={{
                            color: 'var(--color-yellow)',
                            ['--color-ink' as string]: 'var(--color-yellow)',
                          }}
                        >
                          <div className="flex flex-col shrink-0 gap-[clamp(10px,2.5cqw,16px)]">
                            <ZoneBentoCardHeader
                              journeyId="profile"
                              label="YOUR PROFILE"
                              textColor="var(--color-yellow)"
                              iconKind="profile"
                            />
                            <h3 className="card-headline m-0 min-w-0" lang="en">Check out your stats</h3>
                          </div>
                          <div
                            key={`zone-hero-metrics-${Math.round(heroMoney)}-${Math.round(heroCarbon)}`}
                            className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0 flex-shrink-0"
                          >
                            <div className="data-stack data-stack--tight">
                              <span className="data-label" style={{ color: 'var(--color-yellow)' }}>{ENGINE_UI_LABELS.profileWasteMoney}</span>
                              <span className="data-value data-stamp-metric sentinel-live-countup" style={{ color: 'var(--color-ink)' }}>
                                {dbConnected ? (
                                  <StampedMoneyGbp gbp={displayMoney} live={heroLiveGrounded} />
                                ) : (
                                  <span className="zz-body-bold uppercase zz-shimmer-focus" aria-live="polite">
                                    connect
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="data-stack data-stack--tight">
                              <span className="data-label" style={{ color: 'var(--color-yellow)' }}>{ENGINE_UI_LABELS.profileWasteCarbon}</span>
                              <span className="data-value data-stamp-metric sentinel-live-countup" style={{ color: 'var(--color-ink)' }}>
                                {dbConnected ? (
                                  <StampedCarbonKg kg={displayCarbon} />
                                ) : (
                                  <span className="zz-body-bold uppercase zz-shimmer-focus" aria-live="polite">
                                    connect
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </motion.div>
                  )}
                  {cell.type === 'tip' && (() => {
                    const tip = cell.tip
                    const isDiscoveryInject = tip.id.startsWith('inject-')
                    const tipVisited = isZoneCardVisited(tip.id, tip.journey_key)
                    const tipDeepDive = deepDivePendingId === tip.id
                    const discoveryChild = isDiscoveryInjectCard(tip.id)
                    const tipBg = tipVisited
                      ? 'var(--color-pink)'
                      : discoveryChild
                        ? 'var(--color-yellow)'
                        : 'var(--color-purple)'
                    const tipInk = tipVisited
                      ? 'var(--color-yellow)'
                      : discoveryChild
                        ? 'var(--color-purple)'
                        : 'var(--color-yellow)'
                    const tipTextColor = tipInk
                    const semanticWin = tip.dominant_win ?? 'money'
                    const tipHeadline = zoneCardHeadlineFromRaw(
                      tip.title,
                      `${(tip.journey_key || 'tip').replace(/-/g, ' ').toUpperCase()} SAVING`,
                      MAX_ZONE_CARD_HEADLINE_WORDS
                    )
                    const patch = tipDataPatches[tip.id]
                    const moneyDisp = (patch?.money ?? tip.data.money ?? '').replace(/^£\s*/, '').trim() || '0'
                    const carbonDisp = patch?.carbon ?? tip.data.carbon ?? '0'
                    const carbonKgNum = parseCarbonKgFromDisplay(carbonDisp)
                    const greenPulse = isDiscoveryInject && !tip.achievement_discovery && carbonKgNum > 500
                    const snapBloomIn = discoverySnapTipId === tip.id
                    const isAchievementDiscovery = Boolean(tip.achievement_discovery)
                    /* Category nested tips → parent journey Solo Focus (full article + question + loop). */
                    const journeyCell = groovyItems.find(
                      (c): c is GroovyItem & { type: 'journey' } =>
                        c.type === 'journey' && c.item.journey_key === tip.journey_key
                    )
                    const handleTipClick = () => {
                      if (!zoneInteractable) return
                      /* Discovery injections: own Solo Focus + context trap; do not hijack journey tile expand. */
                      if (tip.id.startsWith('inject-')) {
                        soloFocusExpandIntentRef.current = tip.id
                        rememberSoloFocusOpen(tip.id, (tip.journey_key ?? 'home') as JourneyId)
                        if (!openSoloFocus(tip.id, 'discovery')) return
                        setExpandedCardId(null)
                        setExpandedFromTip(null)
                        setExpandedTipId(tip.id)
                        return
                      }
                      if (journeyCell) {
                        openZoneJourneySoloFocus(journeyCell.item, tip)
                      } else {
                        soloFocusExpandIntentRef.current = tip.id
                        rememberSoloFocusOpen(tip.id, (tip.journey_key ?? 'home') as JourneyId)
                        if (!openSoloFocus(tip.id, 'tip')) return
                        setExpandedCardId(null)
                        setExpandedFromTip(null)
                        setExpandedTipId(tip.id)
                      }
                    }
                    return (
                      <motion.button
                        type="button"
                        data-zone-surface="tip"
                        className={[
                          'bento-card-groovy flex flex-col min-h-0 w-full h-full cursor-pointer border-0 text-left',
                          greenPulse ? 'discovery-card-green-pulse' : '',
                          tipVisited ? 'zone-card--visited' : '',
                          tipDeepDive ? 'zone-card--deep-dive-pending' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{
                          borderRadius: 60,
                          boxShadow: 'none',
                          color: tipTextColor,
                          ['--journey-bg' as string]: tipBg,
                          ['--journey-text' as string]: tipTextColor,
                          ['--color-ink' as string]: tipTextColor,
                          ['--semantic-money' as string]: tipTextColor,
                          ['--semantic-carbon' as string]: tipTextColor,
                        }}
                        onClick={handleTipClick}
                        initial={snapBloomIn ? FAMILY_ATOMIC_SURFACE_INITIAL : false}
                        animate={snapBloomIn ? FAMILY_ATOMIC_SURFACE_ANIMATE : undefined}
                        transition={snapBloomIn ? FAMILY_TRANSITION_ATOMIC : undefined}
                        aria-label={`Expand: ${tipHeadline}`}
                        data-dominant-win={semanticWin}
                      >
                        <ZoneBentoCardHeader
                          journeyId={tip.journey_key ?? 'carbon'}
                          showPlus={isAchievementDiscovery}
                          textColor={tipTextColor}
                        />
                        <h3 className="card-headline m-0 min-w-0" lang="en">
                          {tipHeadline}
                        </h3>
                        {tipDeepDive ? (
                          <p className="zz-body-bold m-0 mt-2 uppercase" style={{ color: tipTextColor }}>
                            Deep dive in progress...
                          </p>
                        ) : null}
                        <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0 mt-auto shrink-0">
                          <div className="data-stack data-stack--tight">
                            <span className="data-label" style={{ color: tipTextColor }}>{ENGINE_UI_LABELS.potentialSavings}</span>
                            <span
                              className="data-value text-data data-stamp-metric"
                              style={{ color: 'var(--color-ink)' }}
                            >
                              <StampedMoneyGbp
                                gbp={parseMoneyGbpFromDisplay(
                                  moneyDisp && !/^\s*£/.test(moneyDisp) ? `£${moneyDisp}` : moneyDisp || '0'
                                )}
                              />
                            </span>
                          </div>
                          <div className="data-stack data-stack--tight">
                            <span className="data-label" style={{ color: tipTextColor }}>{ENGINE_UI_LABELS.carbon}</span>
                            <span
                              className="data-value text-data data-stamp-metric"
                              style={{ color: 'var(--color-ink)' }}
                            >
                              <StampedCarbonKg kg={parseCarbonKgFromDisplay(String(carbonDisp || '0'))} />
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })()}
                  {cell.type === 'journey' && (
                    <div
                      className="w-full h-full min-h-0 flex flex-col"
                      id={`zone-journey-${cell.item.journey_key}`}
                    >
                    <ZoneCard
                      cardId={cell.item.id}
                      journeyId={cell.item.journey_key}
                      isVisited={isZoneCardVisited(cell.item.id, cell.item.journey_key)}
                      deepDiveInProgress={deepDivePendingId === cell.item.id}
                      auditState={cell.item.auditState ?? null}
                      title={
                        expandedFromTip?.journey_key === cell.item.journey_key
                          ? expandedFromTip.title
                          : cell.item.journey_key === 'home' && homeSentinelSupportActive
                            ? homeSupportTitle
                            : cell.item.title
                      }
                      isTall={cell.persona === 'tall'}
                      textColorOverride="var(--color-yellow)"
                      carbonValue={expandedFromTip?.journey_key === cell.item.journey_key && (expandedFromTip.data?.carbon ?? '') ? expandedFromTip.data.carbon : cell.item.data.carbon}
                      moneyValue={expandedFromTip?.journey_key === cell.item.journey_key && (expandedFromTip.data?.money ?? '') ? expandedFromTip.data.money : cell.item.data.money}
                      carbonKg={cell.item.carbonKg}
                      moneyGbp={cell.item.moneyGbp}
                      isComplete={completedJourneys.includes(cell.item.journey_key)}
                      onRefineQuestions={undefined}
                      onActionClick={() => openZoneJourneySoloFocus(cell.item)}
                      crawlerTip={expandedFromTip?.journey_key === cell.item.journey_key ? undefined : (cell.item.localCouncilTip || cell.item.insightLabel || cell.item.explanation?.[0])}
                      offerOneLine={
                        expandedFromTip?.journey_key === cell.item.journey_key
                          ? (() => {
                              const generic = 'Answer a few questions to see your personalised impact.'
                              const first = expandedFromTip.explanation?.[0]?.trim()
                              if (first && first !== generic) return first
                              const t = (expandedFromTip.title || '').trim()
                              return t
                                ? `${t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()}. Save and cut carbon — answer a question to see your numbers.`
                                : 'This offer can help you save. Answer a question to see your personalised impact.'
                            })()
                          : undefined
                      }
                      insightLabel={cell.item.insightLabel}
                      attributionSourceLabel={cell.item.sourceLabel}
                      architectSuppliedBy={cell.item.architectSuppliedBy}
                      architectActionLine={cell.item.architectActionLine}
                      insightAlert={cell.item.insightAlert}
                      fromScraper={cell.item.fromScraper}
                      showLocalTag={!!localData?.council && (cell.item.journey_key === 'home' || cell.item.journey_key === 'travel')}
                      localCarbonG={cell.item.journey_key === 'carbon' ? localData?.localCarbonG : undefined}
                      hasLocalGrant={cell.item.journey_key === 'home' && !!localData?.council}
                      localContextBar={cell.item.localContextBar ?? (() => {
                        const place = displayLocationName.trim() || localData?.council
                        return place && localData?.council && typeof localData.localCarbonG === 'number'
                          ? `In ${place}, your live local support context is grounded to your postcode. Your local grid is running at ${Math.round(localData.localCarbonG)}g CO₂e/kWh.`
                          : undefined
                      })()}
                      claimOfferUrl={
                        cell.item.journey_key === 'home' && homeSentinelSupportActive
                          ? homeSupportOfferUrl
                          : cell.item.claimOfferUrl
                      }
                      offerUrlOverride={
                        expandedFromTip?.journey_key === cell.item.journey_key
                          ? expandedFromTip.cta?.url ||
                            expandedFromTip.actions?.actionUrl ||
                            expandedFromTip.actions?.learnUrl ||
                            expandedFromTip.source
                          : undefined
                      }
                      isPriorityAlert={cell.item.isPriorityAlert}
                      verifiedSourceName={cell.item.source_name}
                      verifiedSourceDate={cell.item.source_date}
                      partnerLink={cell.item.partner_link}
                      verifiedAuditMoneyGbp={(() => {
                        const cov = researchCategoryCoverage?.[cell.item.journey_key]
                        const cm =
                          cov?.latestSavingGbp != null && cov.latestSavingGbp > 0
                            ? cov.latestSavingGbp
                            : cov?.latestVerifiedGbp != null && cov.latestVerifiedGbp > 0
                              ? cov.latestVerifiedGbp
                              : null
                        if (cm != null) return cm
                        const metaJourney =
                          researchMeta?.category != null
                            ? researchCategoryToJourneyKey(researchMeta.category)
                            : null
                        return liveResearchData && metaJourney === cell.item.journey_key && researchMeta
                          ? researchMeta.savingAmountGbp ?? researchMeta.verifiedSaving ?? null
                          : null
                      })()}
                      verifiedArchitectProse={(() => {
                        const jid = cell.item.journey_key
                        const p = researchCategoryCoverage?.[jid]?.architectProse?.trim()
                        if (!p) return null
                        return sanitizeArchitectProseForJourney(jid, p)
                      })()}
                      verifiedAuditSourceUrl={(() => {
                        const cov = researchCategoryCoverage?.[cell.item.journey_key]
                        const offer = cov?.latestOfferUrl?.trim()
                        if (offer?.startsWith('http')) return offer
                        const src = cov?.latestSourceUrl?.trim()
                        if (src?.startsWith('http')) return src
                        return researchMeta?.auditSourceUrl ?? null
                      })()}
                      verifiedAuditCategory={(() => {
                        const jid = cell.item.journey_key
                        const cov = researchCategoryCoverage?.[jid]
                        if (!cov?.verified && !cov?.architectProse?.trim()) return null
                        const prose = cov?.architectProse?.trim()
                          ? sanitizeArchitectProseForJourney(jid, cov.architectProse)
                          : null
                        return cov?.verified || prose ? jid : null
                      })()}
                      groovy
                      kineticGrid
                      researchCategoryCoverage={researchCategoryCoverage}
                      insightGenerationPending={
                        !journeyResearchSettled(researchCategoryCoverage?.[cell.item.journey_key], {
                          streamPending: cell.item.streamPending === true,
                          journeyId: cell.item.journey_key,
                        }) &&
                        (cell.item.streamPending === true ||
                          insightPendingKeys.has(cell.item.journey_key))
                      }
                      isExpanded={expandedCardId === cell.item.id}
                      onExpand={() => openZoneJourneySoloFocus(cell.item)}
                      onPatternShiftClose={launchPatternShiftTakeover}
                      onLike={trackZoneLike}
                      isLiked={state.likedCards.includes(cell.item.id)}
                      learnUrl={cell.item.actions?.learnUrl}
                      learnActionType={cell.item.actions?.actionType}
                      showAskZaiTrinity={zoneInteractable}
                      onJourneyAnswered={() => {
                        setRefreshKey((k) => k + 1)
                        setUnlockedCount((prev) => Math.min(prev + 1, 9))
                      }}
                      onEmbeddedAnswerSuccess={() => {
                        setRefreshKey((k) => k + 1)
                        setVmSyncStamp(Date.now())
                      }}
                      onSoloEmbedComplete={(jid) => {
                        window.requestAnimationFrame(() => {
                          window.setTimeout(() => {
                            document.getElementById(`zone-journey-${jid}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            })
                          }, 450)
                        })
                      }}
                      onSwipeNextJourney={openNextJourneyFromExpanded}
                    />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
          </LayoutGroup>
        </motion.div>

        {/* The Rock — after summary + full bento ripple; read-only, no loop on close */}
        {gridFullyRevealed && !expandedCardId && !expandedTipId && zoneInteractable ? (
          <motion.div
            className="zone-rock-strip w-full mt-3 mb-10"
            initial={FAMILY_ATOMIC_SURFACE_INITIAL}
            animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
            transition={FAMILY_TRANSITION_ATOMIC}
          >
            <h2 className="text-marvin text-xl text-[#FDFD00] lowercase mb-6">
              today&apos;s tips
            </h2>
            <RockSavingTips
              habits={rockHabitsWithOffers}
              likedCardIds={state.likedCards}
              visitedTipIds={visitedCardIds}
              onOpenTip={(id) => {
                if (!zoneInteractable) return
                const rockHabit = id.startsWith('rock-') ? ROCK_BY_SLUG.get(id.slice(5)) : undefined
                markCardVisited(id)
                void recordCardVisitHandoff({
                  cardId: id,
                  journeyKey: rockHabit?.journey_key,
                  title: rockHabit?.title,
                })
                setVisitedCardIds(readVisitedCardIds())
                try {
                  sessionStorage.removeItem(`zz_sf_view_${id}`)
                  sessionStorage.removeItem(`zz_sf_lane_${id}`)
                  sessionStorage.removeItem(`zz_sf_q_${id}`)
                } catch {
                  /* ignore */
                }
                if (!openSoloFocus(id, 'tip')) return
                setExpandedCardId(null)
                setExpandedFromTip(null)
                setExpandedTipId(id)
              }}
            />
          </motion.div>
        ) : null}
        </div>
        ) : null}

        {/* Tip expand: same Solo Focus structure as journey cards (tips, amounts, links, question) */}
        {expandedTipId && (() => {
          const rockSlug = expandedTipId.startsWith('rock-') ? expandedTipId.slice(5) : null
          const rockHabit = rockSlug ? ROCK_BY_SLUG.get(rockSlug) : undefined
          const rockTip = rockHabit ? habitToTipCard(rockHabit) : null
          const tipCell = groovyItems.find((c): c is GroovyItem & { type: 'tip'; tip: ZoneTipCard } => c.type === 'tip' && c.tip.id === expandedTipId)
          const tip =
            rockTip ??
            tipCell?.tip ??
            achievementTips.find((t) => t.id === expandedTipId) ??
            discoveryTips.find((t) => t.id === expandedTipId) ??
            effectiveInjectedTips.find((t) => t.id === expandedTipId) ??
            viewModel.tips.find((t) => t.id === expandedTipId)
          if (!tip) return null
          const isRockTip = Boolean(rockTip)
          const isInjectDiscovery = isDiscoveryInjectCard(tip.id)
          const tipVisitedForFocus = isZoneCardVisited(tip.id, tip.journey_key)
          const rawOfferUrl = tip.cta?.url || tip.actions?.actionUrl || tip.actions?.learnUrl || tip.source
          const tipNarrative = (tip.explanation ?? [])
            .map((p) => (typeof p === 'string' ? p.trim() : ''))
            .filter(Boolean)
            .slice(0, 3)
            .join('\n\n')
          const tipActionType = (tip.actions?.actionType || '').toLowerCase()
          const behavioralHint = /turn down|flow temp|lower|switch off|reduce|habit|behaviour|set your/i
          const isBehavioralTip =
            !/^https?:\/\//i.test(String(rawOfferUrl || '')) ||
            (tipActionType === 'learn' && behavioralHint.test(`${tip.title} ${(tip.explanation ?? []).join(' ')}`))
          const tipContext = encodeURIComponent(`${tip.title} ${(tipNarrative || '').slice(0, 220)}`.trim())
          const partnerFirst = pickFirstHttpUrl(tip.partner_link) ?? ''
          const offerUrl = isBehavioralTip
            ? `/zai?context=${tipContext}`
            : rawOfferUrl || partnerFirst
          const ja = state.journeyAnswers ?? {}
          const electricityProvider = ja.home?.electricity_provider || ja.home?.energy_provider
          const gasProvider = ja.home?.gas_provider || ja.home?.energy_provider
          const hasGreenTariff = ja.home?.green_tariff === 'YES'
          const isOctopus = electricityProvider === 'OCTOPUS' || gasProvider === 'OCTOPUS'
          const tipNeedsSwitching = tip.journey_key === 'home' && !isOctopus && !hasGreenTariff
          const tipMoneyGbp = parseMoneyGbpFromDisplay(tip.data.money || '0')
          const tipCtaKind = inferRevenueCtaKind({
            journey: tip.journey_key,
            actionType: tipActionType || 'learn',
            needsSwitching: tipNeedsSwitching,
            isPriorityHome: tip.journey_key === 'home' && !!localData?.council,
          })
          const tipCtaLabel = resolveRevenueCtaLabel(tipCtaKind, tipMoneyGbp)
          const tipCov = researchCategoryCoverage?.[tip.journey_key]
          const tipSanitizedProse = tipCov?.architectProse?.trim()
            ? sanitizeArchitectProseForJourney(tip.journey_key, tipCov.architectProse)
            : null
          const tipAuditMatches = Boolean(
            tipCov?.verified === true || (tipSanitizedProse != null && tipSanitizedProse.length > 0)
          )
          const tipAuditMoney = tipAuditMatches
            ? tipCov?.latestSavingGbp ?? tipCov?.latestVerifiedGbp ?? null
            : null
          return (
            <>
              <SoloFocusOverlay
                key={tip.id}
                startInQuestionMode={false}
                tipVerificationMode={isInjectDiscovery && !tipVisitedForFocus && !isRockTip}
                discoveryFollowUp={tip.followUp}
                auditState={tip.auditState ?? null}
                category={formatZoneCategoryLabel(tip.journey_key ?? 'home')}
                recommendation={tip.title}
                insight={tipNarrative || undefined}
                moneyValue={tip.data.money || '£0'}
                carbonValue={tip.data.carbon || '0 KG CO₂'}
                offerUrl={offerUrl}
                sourceUrl={
                  tipCov?.latestOfferUrl?.trim().startsWith('http')
                    ? tipCov.latestOfferUrl.trim()
                    : tipCov?.latestSourceUrl?.trim().startsWith('http')
                      ? tipCov.latestSourceUrl.trim()
                      : tip.source || tip.actions?.learnUrl
                }
                sourceLabel={tip.sourceLabel}
                architectSuppliedBy={tip.architectSuppliedBy}
                onClose={closeAnySoloFocus}
                onPatternShiftClose={(jid, meta) => {
                  const visitId = meta?.cardId?.trim() || tip.id
                  const pinkOnly =
                    isRockTip || shouldCloseMarkPinkOnly(visitId, jid)
                  launchPatternShiftTakeover(jid, {
                    cardId: visitId,
                    visitedClose: pinkOnly,
                  })
                }}
                cardId={tip.id}
                onLike={trackZoneLike}
                onEmbeddedAnswerSuccess={
                  isRockTip && tip.id.startsWith('rock-')
                    ? () => {
                        const slug = tip.id.replace(/^rock-/, '')
                        const nextHabit = replaceRockSlotAfterLike(slug, state.likedCards)
                        setRockRefreshKey((k) => k + 1)
                        if (nextHabit && openSoloFocus(rockCardId(nextHabit.slug), 'tip')) {
                          setExpandedTipId(rockCardId(nextHabit.slug))
                        } else {
                          closeAnySoloFocus()
                        }
                      }
                    : undefined
                }
                isLiked={state.likedCards.includes(tip.id)}
                journeyId={tip.journey_key}
                onJourneyAnswered={() => {
                  setRefreshKey((k) => k + 1)
                  setUnlockedCount((prev) => Math.min(prev + 1, 9))
                }}
                onSoloEmbedComplete={(jid) => {
                  window.requestAnimationFrame(() => {
                    setTimeout(() => {
                      document.getElementById(`zone-journey-${jid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }, 450)
                  })
                }}
                title={tip.title}
                isCardVisited={isZoneCardVisited(tip.id, tip.journey_key)}
                onTipVerificationComplete={(detail: {
                  moneyGbp: number
                  carbonKg: number
                  coverage: Record<string, ResearchCategoryCoverageRow> | null
                }) => {
                  if (detail.coverage) {
                    setResearchCategoryCoverage(foldCoverageRowsForZone(detail.coverage))
                  }
                  markCardVisited(tip.id)
                  setRefreshKey((k) => k + 1)
                }}
                onDiscoveryTrapComplete={() => setRefreshKey((k) => k + 1)}
                ctaLabel={tipCtaLabel}
                partnerLink={tip.partner_link}
                verifiedSourceName={tip.source_name}
                verifiedSourceDate={tip.source_date}
                tipNeedsSwitching={tipNeedsSwitching}
                isPriorityHome={tip.journey_key === 'home' && !!localData?.council}
                verifiedAuditMoneyGbp={tipAuditMoney}
                verifiedArchitectProse={tipSanitizedProse}
                verifiedAuditSourceUrl={
                  tipCov?.latestOfferUrl?.trim().startsWith('http')
                    ? tipCov.latestOfferUrl.trim()
                    : tipCov?.latestSourceUrl?.trim().startsWith('http')
                      ? tipCov.latestSourceUrl.trim()
                      : null
                }
                verifiedAuditCategory={tipAuditMatches ? tip.journey_key : null}
                researchCategoryCoverage={researchCategoryCoverage}
              />
            </>
          )
        })()}

        {patternShiftJourneyId ? (
          <DiscoveryTakeover
            open
            journeyId={patternShiftJourneyId}
            postcode={liveProfilePostcode || state.profile?.postcode}
            profileData={{
              postcode: liveProfilePostcode || state.profile?.postcode || undefined,
              home_type: state.profile?.homeType ?? null,
              transport_baseline: state.profile?.transport ?? null,
              household: state.profile?.livingSituation ?? null,
              employment_status: state.profile?.employmentStatus ?? null,
            }}
            onAchievementCard={pinAchievementCard}
            onRevealComplete={completeCleanBirth}
          />
        ) : null}

        {isZoneVisible && !zoneHandoffStaging && !isFocusViewOpen && !patternShiftJourneyId ? (
          <ZoneAskZaiDock onActivate={() => router.push(ROUTES.ZAI)} />
        ) : null}

        {isZoneVisible && !zoneHandoffStaging && !expandedCardId && !expandedTipId && !patternShiftJourneyId && (
          <AppFloatingNav active="zone" className="floating-nav--zone-rail-desktop" />
        )}
      </motion.main>
    </LayoutGroup>
  )
}
