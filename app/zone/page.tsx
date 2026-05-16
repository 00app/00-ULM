'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, LayoutGroup, useReducedMotion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { buildZoneViewModel } from '@/lib/logic/zone'
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
import { ROUTES } from '@/lib/routes'
import { useCountUp } from '@/lib/utils/useCountUp'
import {
  ZONE_BENTO_CELL_VARIANTS,
  ZONE_GRID_STAGGER_CHILD_DELAY_SEC,
  FADE_IN_UP,
  ZONE_HERO_FROM_SUMMARY,
  ZIP_OPEN_Z_INITIAL,
  ZIP_OPEN_Z_ANIMATE,
  ZIP_OPEN_Z_TRANSITION,
  STACCATO_CONTAINER_VARIANTS,
  STACCATO_CHILD_VARIANTS,
  STACCATO_TWEEN,
} from '@/lib/animations'

import { ZoneIntelligenceStrip } from '@/app/components/ZoneIntelligenceStrip'
import { LoadingHeartbeat } from '@/app/components/LoadingHeartbeat'
import { parseCoverageFromApi, parseResearchMetaFromApi } from '@/lib/zone/parseScrapeSyncClient'
import {
  readCachedProfileLocality,
  resolveProfileLocalityForPostcode,
} from '@/lib/geocode/resolvePostcodeLocality'
import { appendResearchUserIdQuery, ensureGaryModeForPostcode } from '@/lib/zone/garyMode'
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
import { scheduleSoloFocusRebirthOpen } from '@/lib/soloFocusRebirth'
import {
  bentoSpanClassForPersona,
  JOURNEY_BENTO_PERSONA,
  type BentoPersona,
} from '@/lib/zone/bentoPersona'
import { headlineFromTitle, MAX_ZONE_CARD_HEADLINE_WORDS } from '@/lib/soloFocusCopy'
import { runDiscoveryPulse, readStoredEconomyFingerprint, writeStoredEconomyFingerprint } from '@/lib/agents/heartbeat'
import { buildRemoteBehavioralZoneTips } from '@/lib/zone/remoteBehavioralZoneTips'
import {
  ENGINE_UI_LABELS,
} from '@/lib/logic/engine'
import { fetchLivingPulseSnapshot } from '@/lib/logic/pulse'
import {
  scheduleZoneEngineHydrationPhases,
  ZONE_ENGINE_HYDRATION_LABELS,
  type ZoneEngineStatus,
} from '@/lib/zone/engineHydration'
import { ROCK_BY_SLUG, habitToTipCard, sumRockLikedImpact, rockCardId } from '@/lib/rock/habitsCatalog'
import { replaceRockSlotAfterLike } from '@/lib/rock/rotation'
import { useRockVisibleHabits } from '@/lib/rock/useRockVisibleHabits'
import { useSentinel } from '@/app/hooks/useSentinel'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import { researchCategoryToJourneyKey } from '@/lib/zone/neonResearchMerge'
import {
  FloatingNav,
  ZoneCard,
  Logo,
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

/** Twelve-domain bento wall — asymmetric personas + dense flow (see `lib/zone/bentoPersona.ts`). */
const WALL_JOURNEY_ORDER: JourneyId[] = [
  'home',
  'grants',
  'solar',
  'travel',
  'holidays',
  'food',
  'shopping',
  'money',
  'tech',
  'water',
  'waste',
  'carbon',
]

type GroovyItem =
  | { type: 'hero'; hero: ZoneViewModel['hero'] }
  | { type: 'tip'; tip: ZoneTipCard }
  | { type: 'journey'; item: ZoneJourneyCard; index: number; persona: BentoPersona }

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

/** Zone wall: hero + twelve journey domains (one tile each). */
function getGroovyGridItems(viewModel: ZoneViewModel): GroovyItem[] {
  const journeyCardsOnly = viewModel.journeys.filter((j) => j.id.startsWith('journey-'))
  const byId = new Map(journeyCardsOnly.map((j) => [j.journey_key, j]))
  const items: GroovyItem[] = []
  items.push({ type: 'hero', hero: viewModel.hero })
  WALL_JOURNEY_ORDER.forEach((jid, index) => {
    const item = byId.get(jid)
    if (item) items.push({ type: 'journey', item, index, persona: JOURNEY_BENTO_PERSONA[jid] })
  })
  return items
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
    const sav =
      row.latestSavingGbp != null && row.latestSavingGbp > 0
        ? row.latestSavingGbp
        : row.latestVerifiedGbp != null && row.latestVerifiedGbp > 0
          ? row.latestVerifiedGbp
          : 0
    const ap = row.architectProse?.trim() ?? null
    const hl = row.agentHeadline?.trim() ?? null
    if (sav > 0 || (ap != null && ap.length > 0) || (hl != null && hl.length > 0)) {
      out[jid] = { savingGbp: sav, architectProse: ap, agentHeadline: hl }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Hello {name}. on line 1; punch on line 2 (Marvin / anchor layout). */
function getZoneGreetingParts(
  name: string | undefined,
  completedCount: number,
  heroMoney: number,
  heroCarbon: number
): { line1: string; line2: string } {
  try {
    const who = (typeof name === 'string' ? name.trim() : '') || 'Guest'
    const first = who.split(/\s+/)[0] || 'Guest'
    const count = Number(completedCount) || 0
    const money = Number(heroMoney) || 0
    const carbon = Number(heroCarbon) || 0
    let punch: string
    if (count === 0 && money === 0 && carbon === 0) {
      punch = "Let's fix this."
    } else if (count >= 4 || money + carbon > 500) {
      punch = "You're doing groovy."
    } else if (count >= 1) {
      punch = "We're doing cool."
    } else {
      punch = "You're doing cool."
    }
    return { line1: `Hello ${first}.`.trim(), line2: punch.trim() }
  } catch {
    return { line1: 'Hello.', line2: "You're doing cool." }
  }
}

export default function ZonePage() {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
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
  /** After answering the last question on a journey: contextual line for the next tile we open */
  const [answerHandoffOffer, setAnswerHandoffOffer] = useState<{
    journeyKey: JourneyId
    line: string
  } | null>(null)
  const [sentinelPingJourneyKeys, setSentinelPingJourneyKeys] = useState<Record<string, boolean>>({})
  const [sentinelHeroPing, setSentinelHeroPing] = useState(false)
  const [heroLiveGrounded, setHeroLiveGrounded] = useState(false)
  const [sentinelPulseLabel, setSentinelPulseLabel] = useState<string | null>(null)
  const [dbConnected, setDbConnected] = useState(true)
  const [dbHealthHint, setDbHealthHint] = useState<string | null>(null)
  const [vmResolved, setVmResolved] = useState(false)
  const [engineStatus, setEngineStatus] = useState<ZoneEngineStatus>('idle')
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
  }, [refreshKey])

  const isFocusViewOpen = Boolean(expandedCardId || expandedTipId)

  const closeAnySoloFocus = useCallback(() => {
    setExpandedCardId(null)
    setExpandedFromTip(null)
    setExpandedTipId(null)
    closeSoloFocus()
  }, [closeSoloFocus])

  // Recovery guard: if global focus state is stale but no local expanded card/tip exists,
  // unhide the Zone wall immediately.
  useEffect(() => {
    if (!state.soloFocus.activeCardId) return
    if (expandedCardId || expandedTipId) return
    closeSoloFocus()
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
        badge: 'fresh',
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
    () => [
      ...(sentinelSupportTipCard ? [sentinelSupportTipCard] : []),
      ...remoteBehavioralTipCards,
      ...injectedTips,
      ...sentinelTipCards,
    ],
    [sentinelSupportTipCard, remoteBehavioralTipCards, injectedTips, sentinelTipCards]
  )

  const rockSeed = state.userId ?? 'guest'
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
      if (sessionStorage.getItem('zz_summary_to_zone') === '1') {
        sessionStorage.removeItem('zz_summary_to_zone')
        setHeroFromSummaryHandoff(true)
        setSummaryGridStaggerKey((k) => k + 1)
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
    fetch(`/api/local-intelligence?postcode=${encodeURIComponent(postcode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.council) {
          const resolved = {
            council: data.council,
            region: data.region ?? data.council,
            localCarbonG: typeof data.localCarbonG === 'number' ? data.localCarbonG : undefined,
            ward: typeof data.ward === 'string' ? data.ward : undefined,
            locality: typeof data.locality === 'string' ? data.locality : undefined,
            outcode: typeof data.outcode === 'string' ? data.outcode : undefined,
            country: typeof data.country === 'string' ? data.country : undefined,
          } as LocalIntelligence
          setLocalData(resolved)
          setLocationState({
            local: resolved,
            locationName: formatLocationDisplayName(resolved, postcode),
          })
          setLocalJustLoaded(true)
        }
      })
      .catch(() => {})
  }, [liveProfilePostcode, state.profile?.postcode, setLocationState])

  useEffect(() => {
    if (!localJustLoaded) return
    const t = setTimeout(() => setLocalJustLoaded(false), 1200)
    return () => clearTimeout(t)
  }, [localJustLoaded])

  // Public DB ping — `/api/health/diagnostics` is session/gateway-gated and would read as ✗ for signed-out users.
  useEffect(() => {
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
  }, [refreshKey, liveProfilePostcode])

  const scrapePostcode = useMemo(
    () => resolveScrapePostcode(liveProfilePostcode, state.profile?.postcode ?? null),
    [liveProfilePostcode, state.profile?.postcode]
  )

  const displayLocationName = useMemo(() => {
    const cached = scrapePostcode.length >= 4 ? readCachedProfileLocality(scrapePostcode) : null
    if (cached) return cached
    return formatLocationDisplayName(localData ?? undefined, scrapePostcode)
  }, [localData, scrapePostcode])

  useEffect(() => {
    if (!hydrated) return
    if (scrapePostcode.length < 4) return
    ensureGaryModeForPostcode(scrapePostcode)
    void resolveProfileLocalityForPostcode(scrapePostcode)
  }, [hydrated, scrapePostcode])

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
    let clearHydrationPhases: (() => void) | null = null
    setVmResolved(false)
    setEngineStatus('scraping')
    clearHydrationPhases = scheduleZoneEngineHydrationPhases((phase) => setEngineStatus(phase))
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const parsedMeta = parseResearchMetaFromApi(data)
        const verifiedSaving = parsedMeta?.verifiedSaving
        const savingAmountGbp = parsedMeta?.savingAmountGbp
        const architectProse = parsedMeta?.architectProse
        setResearchMeta(parsedMeta)
        const next = parseCoverageFromApi(data)
        if (next) {
          setResearchCategoryCoverage(next)
          setInsightPendingKeys((prev) => {
            const n = new Set(prev)
            for (const jid of prev) {
              if (next[jid]?.insightReady) n.delete(jid)
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
        if (feedReady) setVmResolved(true)

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
        clearHydrationPhases?.()
        setEngineStatus('idle')
      })
  }, [scrapePostcode, hydrated])

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
        setInjectedTips(Array.isArray(data) ? (data as ZoneTipCard[]) : [])
      })
      .catch(() => {
        if (!cancelled) setInjectedTips([])
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    const onInject = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail
      if (!isDiscoveryTipPayload(detail)) return
      setInjectedTips((prev) => [...prev.filter((c) => c.id !== detail.id), detail])
      setDiscoverySnapTipId(detail.id)
      window.setTimeout(() => setDiscoverySnapTipId((id) => (id === detail.id ? null : id)), 950)
      /* Pulse 3 — zip shut, refresh grid, zip open discovery card in the same slot (120ms). */
      void fetch('/api/zone/tips-refresh', { method: 'POST', credentials: 'include' }).catch(() => {})
      closeAnySoloFocus()
      setRefreshKey((k) => k + 1)
      scheduleSoloFocusRebirthOpen(() => {
        if (openSoloFocus(detail.id, 'discovery')) {
          setExpandedTipId(detail.id)
        }
      })
    }
    window.addEventListener(DISCOVERY_INJECT_EVENT, onInject)
    return () => window.removeEventListener(DISCOVERY_INJECT_EVENT, onInject)
  }, [closeAnySoloFocus, openSoloFocus])

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
      transport_baseline: state.profile?.transport ?? profileFromStorage.transport_baseline,
      age: state.profile?.age ?? profileFromStorage.age,
      employment_status:
        state.profile?.employmentStatus?.trim() || profileFromStorage.employment_status,
    }
    const hasResearchFeed =
      scraped != null ||
      (researchCategoryCoverage != null && Object.keys(researchCategoryCoverage).length > 0) ||
      liveResearchData ||
      Boolean(researchMeta?.architectProse?.trim()) ||
      (researchMeta?.savingAmountGbp != null && researchMeta.savingAmountGbp > 0) ||
      (researchMeta?.verifiedSaving != null && researchMeta.verifiedSaving > 0)

    if (!hasResearchFeed) return

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
        transport_baseline: profile.transport_baseline,
        age: profile.age,
        employment_status: profile.employment_status,
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
                  title: 'RECALCULATING...',
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
      transport_baseline: state.profile?.transport ?? profileFromStorage.transport_baseline,
      age: state.profile?.age ?? profileFromStorage.age,
      employment_status:
        state.profile?.employmentStatus?.trim() || profileFromStorage.employment_status,
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
        transport_baseline: profile.transport_baseline,
        age: profile.age,
        employment_status: profile.employment_status,
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
  }, [
    state.profile,
    liveProfilePostcode,
    scraped,
    localData,
    refreshKey,
    effectiveInjectedTips,
    marketContext,
    homeUnitRates,
    ratesSourceUrl,
    researchMeta,
    liveResearchData,
    researchCategoryCoverage,
    hydrated,
  ])

  const groovyItems = getGroovyGridItems(viewModel)
  const displayItems: GroovyItem[] = useMemo(() => [...groovyItems], [groovyItems])
  const isDev = process.env.NODE_ENV !== 'production'
  const researchLoading = !vmResolved
  const zoneInteractable = hydrated && vmResolved
  const zoneRevealCount = displayItems.length

  const openNextJourneyFromExpanded = useCallback(
    (jid: JourneyId) => {
      const idx = WALL_JOURNEY_ORDER.indexOf(jid)
      for (let step = idx + 1; step < WALL_JOURNEY_ORDER.length; step++) {
        const nextKey = WALL_JOURNEY_ORDER[step]
        for (const c of displayItems) {
          if (c.type === 'journey' && c.item.journey_key === nextKey) {
            if (!openSoloFocus(c.item.id, 'journey')) return
            setExpandCard(
              {
                id: c.item.id,
                title: c.item.title,
                journey_key: c.item.journey_key,
                data: c.item.data,
                explanation: c.item.explanation,
                localCouncilTip: c.item.localCouncilTip,
                source: c.item.source,
                sourceLabel: c.item.sourceLabel,
                actions: c.item.actions,
              },
              'zone',
            )
            setExpandedCardId(c.item.id)
            setExpandedFromTip(null)
            setExpandedTipId(null)
            return
          }
        }
      }
    },
    [displayItems, openSoloFocus],
  )

  const advanceToNextJourneyAfterAnswer = useCallback(
    ({ fromJourneyId, offerLine }: { fromJourneyId: JourneyId; offerLine: string }) => {
      const idx = WALL_JOURNEY_ORDER.indexOf(fromJourneyId)
      const nextKey =
        idx >= 0 && idx < WALL_JOURNEY_ORDER.length - 1 ? WALL_JOURNEY_ORDER[idx + 1] : null
      closeAnySoloFocus()
      if (nextKey) {
        setAnswerHandoffOffer({ journeyKey: nextKey, line: offerLine })
        // Let the current solo-focus collapse finish before opening the next card.
        window.setTimeout(() => openNextJourneyFromExpanded(fromJourneyId), 280)
      } else {
        setAnswerHandoffOffer(null)
      }
    },
    [closeAnySoloFocus, openNextJourneyFromExpanded],
  )

  /** Oversized slot-machine numbers: strict journey-sum totals + liked Rock habits. */
  const vmJourneyTotals = useMemo(
    () => (viewModel ? sumJourneyGridTotals(viewModel) : { totalMoney: 0, totalCarbon: 0 }),
    [viewModel]
  )
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
  const heroMoneyNum = vmJourneyTotals.totalMoney
  const heroCarbonNum = vmJourneyTotals.totalCarbon
  const rockLikedImpact = sumRockLikedImpact(state.likedCards)
  const heroMoney = (dbConnected ? (state.heroTotals?.totalMoney ?? heroMoneyNum) : 0) + rockLikedImpact.money
  const heroCarbon = (dbConnected ? (state.heroTotals?.totalCarbon ?? heroCarbonNum) : 0) + rockLikedImpact.carbon
  const displayMoney = useCountUp(heroMoney, { duration: 120 })
  const displayCarbon = useCountUp(heroCarbon, { duration: 120 })
  const heroDataSource = dbConnected && neonVerifiedMoney ? 'VERIFIED AUDIT' : 'ESTIMATED AUDIT'

  /** One block (newline between lines), question-text style + lowercase. */
  const zoneGreetingBlock = useMemo(() => {
    const { line1, line2 } = getZoneGreetingParts(
      state?.profile?.name,
      Array.isArray(completedJourneys) ? completedJourneys.length : 0,
      heroMoney,
      heroCarbon
    )
    return `${line1}\n${line2}`
  }, [state?.profile?.name, completedJourneys, heroMoney, heroCarbon])

  return (
    <LayoutGroup>
      <motion.main
        className="zone relative min-h-screen overflow-x-hidden pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]"
        style={{
          background: 'transparent',
          color: 'var(--color-yellow)',
          boxShadow: sentinel.pulseColor
            ? `inset 0 0 140px color-mix(in srgb, ${sentinel.pulseColor} 22%, transparent)`
            : undefined,
        }}
        {...FADE_IN_UP}
      >
        {/* 1. ZONE ANCHOR (Masthead + Ask Zai) — design system: purple bg, yellow type */}
        <motion.div
          className="zone-anchor flex flex-col items-center pt-0 pb-0"
          aria-hidden={false}
          variants={STACCATO_CONTAINER_VARIANTS}
          initial="hidden"
          animate="visible"
        >
          <header className="zone-masthead flex flex-col items-center w-full px-4 flex-shrink-0 py-0 gap-0">
            <motion.div variants={STACCATO_CHILD_VARIANTS} className="flex-shrink-0">
              <Logo width={66} className="zone-logo" style={{ color: 'var(--color-yellow)' }} />
            </motion.div>
          </header>
          <motion.div
            variants={STACCATO_CHILD_VARIANTS}
            className="w-full flex flex-col items-center px-2 py-0"
            aria-live="polite"
          >
            <motion.h3
              className="question-text zone-welcome text-center m-0"
              style={{ color: 'var(--color-yellow)', lineHeight: 0.8 }}
              variants={STACCATO_CHILD_VARIANTS}
              initial="hidden"
              animate="visible"
            >
              {zoneGreetingBlock}
            </motion.h3>
          </motion.div>
          <motion.div variants={STACCATO_CHILD_VARIANTS} className="w-[90%] max-w-[400px] relative zone-ask-zai-wrap">
            <input
              type="text"
              placeholder="ASK ZAI..."
              className="zone-ask-zai-pill w-full h-[54px] rounded-full border-none px-8 text-marvin focus:ring-2 focus:ring-[var(--color-yellow)] focus:ring-offset-2 focus:ring-offset-[var(--color-purple)] uppercase caret-[var(--color-purple)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') router.push(ROUTES.ZAI)
              }}
              onClick={() => router.push(ROUTES.ZAI)}
              aria-label="Ask Zai — tap or press Enter to open chat"
            />
          </motion.div>
          {sentinelPulseLabel ? (
            <motion.p
              key={sentinelPulseLabel}
              className="zz-body-bold m-0 mt-2 uppercase"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={STACCATO_TWEEN}
              style={{ color: 'var(--color-yellow)' }}
            >
              {sentinelPulseLabel}
            </motion.p>
          ) : null}
        </motion.div>

        {/* 2. BENTO WALL — always mounted; skeleton pulse until research hydrates */}
        <motion.div className="zone-container" aria-hidden={false}>
          <motion.div
            key={summaryGridStaggerKey}
            data-testid="zone-grid-mounted"
            data-profile-postcode={scrapePostcode}
            data-vm-sync={String(vmSyncStamp)}
            data-research-loading={researchLoading ? '1' : '0'}
            className={`groovy-zone-grid mx-auto ${localJustLoaded ? 'zone-grid-local-shiver' : ''}`}
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
                      className="zone-hero-transparent relative flex flex-col items-stretch w-full flex-1 min-h-0 h-full text-left"
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
                      <div className="w-full flex-1 min-h-0 flex flex-col">
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
                            <div className="flex items-center justify-between w-full shrink-0">
                              <span className="card-top-label" style={{ color: 'var(--color-yellow)' }}>YOUR PROFILE</span>
                              <span className="card-top-arrow card-top-arrow--hint flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, color: 'currentColor', background: 'transparent' }} aria-hidden>
                                <svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                                </svg>
                              </span>
                            </div>
                            <h3 className="card-headline m-0 min-w-0" lang="en">Check out your stats</h3>
                          </div>
                          <div
                            key={`zone-hero-metrics-${Math.round(heroMoney)}-${Math.round(heroCarbon)}`}
                            className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0 flex-shrink-0"
                          >
                            <div className="data-stack data-stack--tight">
                              <span className="data-label" style={{ color: 'var(--color-yellow)' }}>{ENGINE_UI_LABELS.potentialSavings}</span>
                              <span className="data-value data-stamp-metric sentinel-live-countup" style={{ color: 'var(--color-ink)' }}>
                                {dbConnected ? (
                                  <StampedMoneyGbp gbp={displayMoney} live={heroLiveGrounded} />
                                ) : (
                                  <span className="zz-body-bold uppercase zz-shimmer-focus" aria-live="polite">
                                    Recalculating...
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="data-stack data-stack--tight">
                              <span className="data-label" style={{ color: 'var(--color-yellow)' }}>{ENGINE_UI_LABELS.carbon}</span>
                              <span className="data-value data-stamp-metric sentinel-live-countup" style={{ color: 'var(--color-ink)' }}>
                                {dbConnected ? (
                                  <StampedCarbonKg kg={displayCarbon} />
                                ) : (
                                  <span className="zz-body-bold uppercase zz-shimmer-focus" aria-live="polite">
                                    Recalculating...
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
                    const tipBg = 'var(--color-pink)'
                    const tipTextColor = 'var(--color-yellow)'
                    const semanticWin = tip.dominant_win ?? 'money'
                    const tipLabelH = 14
                    const tipArrowSz = tipLabelH * 3
                    const tipHeadline = headlineFromTitle(tip.title, MAX_ZONE_CARD_HEADLINE_WORDS)
                    const patch = tipDataPatches[tip.id]
                    const moneyDisp = (patch?.money ?? tip.data.money ?? '').replace(/^£\s*/, '').trim() || '0'
                    const carbonDisp = patch?.carbon ?? tip.data.carbon ?? '0'
                    const carbonKgNum = parseCarbonKgFromDisplay(carbonDisp)
                    const greenPulse = isDiscoveryInject && carbonKgNum > 500
                    const snapBloomIn = discoverySnapTipId === tip.id
                    /* Expand the matching journey card so user gets full experience (tips, links, questions). */
                    const journeyCell = groovyItems.find((c): c is GroovyItem & { type: 'journey' } => c.type === 'journey' && c.item.journey_key === tip.journey_key)
                    const handleTipClick = () => {
                      /* Discovery injections: own Solo Focus + context trap; do not hijack journey tile expand. */
                      if (tip.id.startsWith('inject-')) {
                        if (!openSoloFocus(tip.id, 'discovery')) return
                        setExpandedTipId(tip.id)
                        return
                      }
                      if (journeyCell) {
                        if (!openSoloFocus(journeyCell.item.id, 'journey')) return
                        setExpandCard(
                          {
                            id: journeyCell.item.id,
                            title:
                              journeyCell.item.journey_key === 'home' && homeSentinelSupportActive
                                ? homeSupportTitle
                                : journeyCell.item.title,
                            journey_key: journeyCell.item.journey_key,
                            data: journeyCell.item.data,
                            explanation: journeyCell.item.explanation,
                            localCouncilTip: journeyCell.item.localCouncilTip,
                            source: journeyCell.item.source,
                            sourceLabel: journeyCell.item.sourceLabel,
                            actions:
                              journeyCell.item.journey_key === 'home' && homeSentinelSupportActive
                                ? { ...(journeyCell.item.actions ?? {}), actionUrl: homeSupportOfferUrl, learnUrl: homeSupportOfferUrl }
                                : journeyCell.item.actions,
                          },
                          'zone'
                        )
                        setExpandedCardId(journeyCell.item.id)
                        setExpandedFromTip(tip)
                      } else {
                        if (!openSoloFocus(tip.id, 'tip')) return
                        setExpandedTipId(tip.id)
                      }
                    }
                    return (
                      <motion.button
                        type="button"
                        data-zone-surface="tip"
                        className={`bento-card-groovy flex flex-col min-h-0 w-full h-full cursor-pointer border-0 text-left${greenPulse ? ' discovery-card-green-pulse' : ''}`}
                        style={{
                          borderRadius: 60,
                          boxShadow: 'none',
                          ['--journey-bg' as string]: tipBg,
                          ['--journey-text' as string]: tipTextColor,
                          ['--color-ink' as string]: tipTextColor,
                          ['--semantic-money' as string]: semanticWin === 'money' ? 'var(--color-yellow)' : tipTextColor,
                          ['--semantic-carbon' as string]: semanticWin === 'carbon' ? 'var(--color-pink)' : tipTextColor,
                        }}
                        onClick={handleTipClick}
                        initial={snapBloomIn || isDiscoveryInject ? ZIP_OPEN_Z_INITIAL : false}
                        animate={ZIP_OPEN_Z_ANIMATE}
                        transition={ZIP_OPEN_Z_TRANSITION}
                        aria-label={`Expand: ${tipHeadline}`}
                        data-dominant-win={semanticWin}
                      >
                        <div className="flex items-center justify-between w-full shrink-0 gap-2">
                          <span className="card-top-label" style={{ color: tipTextColor }}>
                            {(tip.journey_key || 'TIP').replace(/-/g, ' ').toUpperCase()}
                          </span>
                          {tip.badge ? (
                            <span
                              className="zz-body-bold shrink-0 rounded-full px-3 py-0.5 text-xs uppercase"
                              style={{
                                background: 'var(--color-purple)',
                                color: 'var(--color-yellow)',
                                fontFamily: 'var(--font-marvin)',
                              }}
                            >
                              {tip.badge}
                            </span>
                          ) : null}
                          <span className="card-top-arrow card-top-arrow--hint flex items-center justify-center flex-shrink-0" style={{ width: tipArrowSz, height: tipArrowSz, color: 'currentColor', background: 'transparent' }} aria-hidden>
                            <svg width={tipArrowSz} height={tipArrowSz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 17L17 7M17 7H7M17 7v10" />
                            </svg>
                          </span>
                        </div>
                        <h3 className="card-headline m-0 min-w-0" lang="en">
                          {tipHeadline}
                        </h3>
                        <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0 mt-auto shrink-0">
                          <div className="data-stack data-stack--tight">
                            <span className="data-label" style={{ color: tipTextColor }}>{ENGINE_UI_LABELS.potentialSavings}</span>
                            <span
                              className={
                                isDiscoveryInject
                                  ? 'text-data discovery-inject-money-h2 data-value data-stamp-metric'
                                  : 'data-value text-data data-stamp-metric'
                              }
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
                              className={
                                isDiscoveryInject
                                  ? 'data-value text-data discovery-inject-carbon-secondary data-stamp-metric'
                                  : 'data-value text-data data-stamp-metric'
                              }
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
                      journeyId={cell.item.journey_key}
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
                      onActionClick={() => {
                        if (!zoneInteractable) return
                        if (!openSoloFocus(cell.item.id, 'journey')) return
                        setExpandCard(
                          {
                            id: cell.item.id,
                            title:
                              cell.item.journey_key === 'home' && homeSentinelSupportActive
                                ? homeSupportTitle
                                : cell.item.title,
                            journey_key: cell.item.journey_key,
                            data: cell.item.data,
                            explanation: cell.item.explanation,
                            localCouncilTip: cell.item.localCouncilTip,
                            source: cell.item.source,
                            sourceLabel: cell.item.sourceLabel,
                            actions:
                              cell.item.journey_key === 'home' && homeSentinelSupportActive
                                ? { ...(cell.item.actions ?? {}), actionUrl: homeSupportOfferUrl, learnUrl: homeSupportOfferUrl }
                                : cell.item.actions,
                          },
                          'zone'
                        )
                        setExpandedCardId(cell.item.id)
                        setExpandedFromTip(null)
                      }}
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
                          : answerHandoffOffer?.journeyKey === cell.item.journey_key
                            ? answerHandoffOffer.line
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
                        const cov = researchCategoryCoverage?.[cell.item.journey_key]
                        const p = cov?.architectProse?.trim()
                        if (p) return p
                        const metaJourney =
                          researchMeta?.category != null
                            ? researchCategoryToJourneyKey(researchMeta.category)
                            : null
                        return liveResearchData && metaJourney === cell.item.journey_key && researchMeta
                          ? researchMeta.architectProse ?? null
                          : null
                      })()}
                      verifiedAuditSourceUrl={(() => {
                        const cov = researchCategoryCoverage?.[cell.item.journey_key]
                        const offer = cov?.latestOfferUrl?.trim()
                        if (offer?.startsWith('http')) return offer
                        const src = cov?.latestSourceUrl?.trim()
                        if (src?.startsWith('http')) return src
                        return researchMeta?.auditSourceUrl ?? null
                      })()}
                      verifiedAuditCategory={
                        researchCategoryCoverage?.[cell.item.journey_key]?.verified
                          ? cell.item.journey_key
                          : researchMeta?.category ?? null
                      }
                      groovy
                      kineticGrid
                      researchCategoryCoverage={researchCategoryCoverage}
                      insightGenerationPending={
                        cell.item.streamPending === true ||
                        insightPendingKeys.has(cell.item.journey_key)
                      }
                      isExpanded={expandedCardId === cell.item.id}
                      onExpand={() => {
                        if (!openSoloFocus(cell.item.id, 'journey')) return
                        if (answerHandoffOffer && answerHandoffOffer.journeyKey !== cell.item.journey_key) {
                          setAnswerHandoffOffer(null)
                        }
                        setExpandCard(
                          {
                            id: cell.item.id,
                            title:
                              cell.item.journey_key === 'home' && homeSentinelSupportActive
                                ? homeSupportTitle
                                : cell.item.title,
                            journey_key: cell.item.journey_key,
                            data: cell.item.data,
                            explanation: cell.item.explanation,
                            localCouncilTip: cell.item.localCouncilTip,
                            source: cell.item.source,
                            sourceLabel: cell.item.sourceLabel,
                            actions:
                              cell.item.journey_key === 'home' && homeSentinelSupportActive
                                ? { ...(cell.item.actions ?? {}), actionUrl: homeSupportOfferUrl, learnUrl: homeSupportOfferUrl }
                                : cell.item.actions,
                          },
                          'zone'
                        )
                        setExpandedCardId(cell.item.id)
                        setExpandedFromTip(null)
                      }}
                      onClose={() => {
                        closeAnySoloFocus()
                        setAnswerHandoffOffer(null)
                      }}
                      cardId={cell.item.id}
                      onLike={(id, title, savings) => toggleLike(id, title, savings)}
                      isLiked={state.likedCards.includes(cell.item.id)}
                      learnUrl={cell.item.actions?.learnUrl}
                      learnActionType={cell.item.actions?.actionType}
                      onAskZai={() => router.push(ROUTES.ZAI)}
                      onJourneyAnswered={() => {
                        setRefreshKey((k) => k + 1)
                        setUnlockedCount((prev) => Math.min(prev + 1, 9))
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
                      onAdvanceToNextJourneyAfterAnswer={advanceToNextJourneyAfterAnswer}
                    />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        </motion.div>

        {/* The Rock — heartbeat above Saving Tips while master wall hydrates */}
        {!expandedCardId && !expandedTipId && (
          <motion.div className="w-full mt-8 mb-24">
            <LoadingHeartbeat active={researchLoading} />
            <RockSavingTips
              habits={rockVisibleHabits}
              likedCardIds={state.likedCards}
              onOpenTip={(id) => {
                if (!zoneInteractable) return
                if (!openSoloFocus(id, 'tip')) return
                setExpandedTipId(id)
              }}
            />
          </motion.div>
        )}

        {/* Tip expand: same Solo Focus structure as journey cards (tips, amounts, links, question) */}
        {expandedTipId && (() => {
          const rockSlug = expandedTipId.startsWith('rock-') ? expandedTipId.slice(5) : null
          const rockHabit = rockSlug ? ROCK_BY_SLUG.get(rockSlug) : undefined
          const rockTip = rockHabit ? habitToTipCard(rockHabit) : null
          const tipCell = groovyItems.find((c): c is GroovyItem & { type: 'tip'; tip: ZoneTipCard } => c.type === 'tip' && c.tip.id === expandedTipId)
          const tip = rockTip ?? tipCell?.tip ?? viewModel.tips.find((t) => t.id === expandedTipId)
          if (!tip) return null
          const isRockTip = Boolean(rockTip)
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
          const tipCtaLabel = isBehavioralTip
            ? `RECLAIM £${Math.max(0, Math.round(tipMoneyGbp)).toLocaleString('en-GB')} NOW`
            : resolveRevenueCtaLabel(tipCtaKind, tipMoneyGbp)
          const tipAuditMatches =
            Boolean(liveResearchData && researchMeta?.category === tip.journey_key)
          const tipAuditMoney =
            tipAuditMatches
              ? researchMeta?.savingAmountGbp ?? researchMeta?.verifiedSaving ?? null
              : null
          return (
            <>
              <SoloFocusOverlay
                key={tip.id}
                auditState={tip.auditState ?? null}
                category={(tip.journey_key || 'TIP').replace(/-/g, ' ')}
                recommendation={tip.title}
                insight={tipNarrative || undefined}
                moneyValue={tip.data.money || '£0'}
                carbonValue={tip.data.carbon || '0 KG CO₂'}
                offerUrl={offerUrl}
                sourceUrl={
                  tipAuditMatches && researchMeta?.auditSourceUrl
                    ? researchMeta.auditSourceUrl
                    : tip.source || tip.actions?.learnUrl
                }
                sourceLabel={tip.sourceLabel}
                architectSuppliedBy={tip.architectSuppliedBy}
                onClose={closeAnySoloFocus}
                onAskZai={() => router.push(ROUTES.ZAI)}
                cardId={tip.id}
                onLike={(id, title, savings) => toggleLike(id, title, savings)}
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
                discoveryFollowUp={tip.followUp}
                onDiscoveryTrapComplete={() => setRefreshKey((k) => k + 1)}
                ctaLabel={tipCtaLabel}
                partnerLink={tip.partner_link}
                verifiedSourceName={tip.source_name}
                verifiedSourceDate={tip.source_date}
                tipNeedsSwitching={tipNeedsSwitching}
                isPriorityHome={tip.journey_key === 'home' && !!localData?.council}
                verifiedAuditMoneyGbp={tipAuditMoney}
                verifiedArchitectProse={tipAuditMatches ? researchMeta?.architectProse ?? null : null}
                verifiedAuditSourceUrl={researchMeta?.auditSourceUrl ?? null}
                verifiedAuditCategory={researchMeta?.category ?? null}
                researchCategoryCoverage={researchCategoryCoverage}
              />
            </>
          )
        })()}

        {!expandedCardId && !expandedTipId && (
          <FloatingNav
            active="zone"
            onNavigate={(key) => {
              if (key === 'likes') router.push(ROUTES.LIKES)
              if (key === 'zone') router.push(ROUTES.ZONE)
              if (key === 'summary') router.push(ROUTES.SETTINGS)
              if (key === 'chat') router.push(ROUTES.ZAI)
            }}
            hasNewTipForZai={!!scraped && Object.keys(scraped).length > 0}
          />
        )}
        {vmResolved && engineStatus !== 'idle' ? (
          <p className="zone-engine-hydration-status zone-engine-hydration-strip m-0" aria-live="polite">
            {ZONE_ENGINE_HYDRATION_LABELS[engineStatus]}
          </p>
        ) : null}
        <ZoneIntelligenceStrip
          variant="zone"
          suppressOverlay={Boolean(expandedCardId || expandedTipId)}
          debugHudLine={
            isDev
              ? `grid:${displayItems.length} | journeys:${viewModel.journeys.length} | tips:${viewModel.tips.length} | focus:${expandedCardId ? 'card' : expandedTipId ? 'tip' : 'none'} | appFocus:${state.soloFocus.activeCardId ? 'on' : 'off'}`
              : undefined
          }
          dbHealthHint={dbHealthHint}
          dbConnected={dbConnected}
          neonVerifiedMoney={neonVerifiedMoney}
          verifiedSaving={researchMeta?.verifiedSaving}
          savingAmountGbp={researchMeta?.savingAmountGbp}
          localityLabel={displayLocationName.trim() || localData?.council || undefined}
          gridGPerKwh={
            typeof localData?.localCarbonG === 'number' ? localData.localCarbonG : undefined
          }
          researchCategory={researchMeta?.category ?? null}
          hasArchitectProse={
            Boolean(researchMeta?.architectProse?.trim()) ||
            Object.values(researchCategoryCoverage ?? {}).some(
              (c) => c.insightReady || Boolean(c.architectProse?.trim()) || Boolean(c.agentHeadline?.trim())
            )
          }
          hasOfferUrl={Boolean(researchMeta?.offerUrl?.trim())}
          categoryCoverage={researchCategoryCoverage}
          scrapePostcode={scrapePostcode}
          rightAside={
            <span
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-marvin)',
                fontSize: 11,
                lineHeight: 1.1,
                textTransform: 'uppercase',
                letterSpacing: '0.01em',
                opacity: 0.9,
                color: sentinel.pulseColor ?? 'var(--color-yellow)',
              }}
            >
              Sentinel Brain: Active | Skill: Live-Impact v1.0
            </span>
          }
        />
      </motion.main>
    </LayoutGroup>
  )
}
