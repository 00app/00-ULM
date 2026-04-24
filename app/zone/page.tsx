'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { buildZoneViewModel } from '@/lib/zone/buildZoneViewModel'
import type { ZoneViewModel, ZoneJourneyCard, ZoneTipCard } from '@/lib/zone/buildZoneViewModel'
import {
  applyArchitectEnrichment,
  architectCacheFingerprint,
  type ArchitectJourneyPayload,
} from '@/lib/agents/contentArchitect'
import { buildContentArchitectCardPayload } from '@/lib/zone/architectZoneRequest'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { ROUTES } from '@/lib/routes'
import { useCountUp } from '@/lib/utils/useCountUp'
import {
  ZONE_ANCHOR_VARIANTS,
  SPRING_BLOOM,
  SPRING_TAP,
  FADE_IN_UP,
  ZONE_HERO_FROM_SUMMARY,
  ELASTIC_PING,
} from '@/lib/animations'

import { JourneyBentoCard } from '../components/JourneyBentoCard'
import { SoloFocusOverlay } from '../components/SoloFocusOverlay'
import ClientOnly from '../components/ClientOnly'
import { Logo } from '../components/Logo'
import FloatingNav from '../components/FloatingNav'
import { ZeroGateShutter } from '@/app/components/background/ZeroGateShutter'
import { setExpandCard } from '@/lib/expandStorage'
import { getJourneyColorHex } from '@/lib/journeyColors'
import { DISCOVERY_INJECT_EVENT } from '@/lib/discoveryInject'
import { runDiscoveryPulse, readStoredEconomyFingerprint, writeStoredEconomyFingerprint } from '@/lib/agents/heartbeat'
import { RockSavingTips } from '../components/RockSavingTips'
import { buildWickBehavioralZoneTips } from '@/lib/zone/wickBehavioralZoneTips'
import { ROCK_BY_SLUG, habitToTipCard, sumRockLikedImpact, rockCardId } from '@/lib/rock/habitsCatalog'
import { replaceRockSlotAfterLike } from '@/lib/rock/rotation'
import { useRockVisibleHabits } from '@/lib/rock/useRockVisibleHabits'
import { useSentinel } from '@/app/hooks/useSentinel'

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

/** High-Tension Bento Wall — order and grid persona (Square / Wide / Tall) */
const WALL_JOURNEY_ORDER: JourneyId[] = ['home', 'travel', 'food', 'shopping', 'money', 'carbon', 'tech', 'waste', 'holidays']

type BentoPersona = 'square' | 'wide' | 'tall'
const JOURNEY_PERSONA: Record<JourneyId, BentoPersona> = {
  home: 'wide',
  travel: 'wide',
  food: 'square',
  shopping: 'square',
  money: 'tall',
  carbon: 'square',
  tech: 'square',
  waste: 'wide',
  holidays: 'wide',
}

type GroovyItem =
  | { type: 'hero'; hero: ZoneViewModel['hero'] }
  | { type: 'tip'; tip: ZoneTipCard }
  | { type: 'journey'; item: ZoneJourneyCard; index: number; persona: BentoPersona }
  | { type: 'custom'; id: string; headline: string }
  | { type: 'general_question' }

/** Yellow background journeys → purple text; pink background → yellow text (legibility) */
const YELLOW_JOURNEY_IDS: JourneyId[] = ['home', 'food', 'money', 'tech', 'holidays']

/** Circular goal options (onboarding style) — selecting one adds a card above in real time */
const GOAL_OPTIONS = [
  'Eat less meat',
  'Drive less',
  'Save energy',
  'Reduce waste',
  'Fly less',
  'Greener tariff',
]

const UNLOCKED_COUNT_KEY = 'zoneUnlockedCount'
const SENTINEL_RECENT_CHAT_KEY = 'zz_recent_chat_history'

function readRecentChatHistoryFromStorage(): Array<{ role: 'user' | 'zai'; text: string }> {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SENTINEL_RECENT_CHAT_KEY)
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

/** Zone wall: hero + nine journey categories (no purple MORE/filler tiles). */
function getGroovyGridItems(viewModel: ZoneViewModel): GroovyItem[] {
  const journeyCardsOnly = viewModel.journeys.filter((j) => j.id.startsWith('journey-'))
  const byId = new Map(journeyCardsOnly.map((j) => [j.journey_key, j]))
  const items: GroovyItem[] = []
  items.push({ type: 'hero', hero: viewModel.hero })
  WALL_JOURNEY_ORDER.forEach((jid, index) => {
    const item = byId.get(jid)
    if (item) items.push({ type: 'journey', item, index, persona: JOURNEY_PERSONA[jid] })
  })
  return items
}

/** Default zone when user skips profile: empty profile + empty answers so zone always renders */
function getDefaultZoneViewModel(): ZoneViewModel {
  const emptyAnswers = {} as Record<JourneyId, Record<string, string>>
  return buildZoneViewModel({ profile: {}, journeyAnswers: emptyAnswers })
}

/** 6-word max greeting: Hello {name}. + how they're doing (groovy / cool / let's fix this) */
function getZoneGreeting(
  name: string | undefined,
  completedCount: number,
  heroMoney: number,
  heroCarbon: number
): string {
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
    return `Hello ${first}. ${punch}`.trim()
  } catch {
    return "Hello. You're doing cool."
  }
}

export default function ZonePage() {
  const router = useRouter()
  const { state, toggleLike, setHeroTotals, setLocationState } = useApp()

  const [viewModel, setViewModel] = useState<ZoneViewModel>(getDefaultZoneViewModel)
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
  /** Zone lock: always nine categories visible. */
  const [unlockedCount, setUnlockedCount] = useState(() => {
    if (typeof window === 'undefined') return 9
    const raw = localStorage.getItem(UNLOCKED_COUNT_KEY)
    const n = raw ? Number.parseInt(raw, 10) : NaN
    return Number.isFinite(n) ? 9 : 9
  })
  /** v1.7: index of the journey card that just popped in (for spring animation); cleared after animation. */
  const [popInIndex, setPopInIndex] = useState<number | null>(null)
  /** Discovery Engine: server-stored tip injections (same store as POST /api/openclaw/inject). */
  const [injectedTips, setInjectedTips] = useState<ZoneTipCard[]>([])
  /** Discovery Pulse: patch £/kg on inject cards when economy fingerprint changes. */
  const [tipDataPatches, setTipDataPatches] = useState<Record<string, { money?: string; carbon?: string }>>({})
  /** Framer SPRING_BLOOM (320, 24) target for freshly injected discovery card. */
  const [discoverySpringTipId, setDiscoverySpringTipId] = useState<string | null>(null)
  /** User-added cards from general question at bottom */
  const [customCards, setCustomCards] = useState<Array<{ id: string; headline: string }>>([])
  /** Bump when a Rock slot is replaced after Like (zip-shutter). */
  const [rockRefreshKey, setRockRefreshKey] = useState(0)
  /** One-shot hero zoom after profile summary Zip-Shutter → Zone */
  const [heroFromSummaryHandoff, setHeroFromSummaryHandoff] = useState(false)
  /** After answering the last question on a journey: contextual line for the next tile we open */
  const [answerHandoffOffer, setAnswerHandoffOffer] = useState<{
    journeyKey: JourneyId
    line: string
  } | null>(null)
  const [sentinelPingJourneyKeys, setSentinelPingJourneyKeys] = useState<Record<string, boolean>>({})
  const [sentinelHeroPing, setSentinelHeroPing] = useState(false)
  const isFocusViewOpen = Boolean(expandedCardId || expandedTipId)

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
  const homeSentinelGrantActive = Boolean(sentinel.grantFound && sentinel.firecrawlGrant?.title)
  const homeGrantTitle = sentinel.firecrawlGrant?.title ?? '£9,000 RURAL HEAT GRANT'
  const homeGrantOfferUrl =
    sentinel.firecrawlGrant?.claimOfferUrl ?? 'https://www.homeenergyscotland.org/home-energy-scotland-grant-loan'
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
  const wickBehavioralTipCards = useMemo<ZoneTipCard[]>(() => {
    const postcode = (state.profile?.postcode ?? '').replace(/\s+/g, '').toUpperCase()
    if (!/^KW/i.test(postcode)) return []
    return buildWickBehavioralZoneTips()
  }, [state.profile?.postcode])

  const sentinelGrantTipCard = useMemo<ZoneTipCard | null>(() => {
    if (!sentinel.grantFound) return null
    const postcode = (state.profile?.postcode ?? '').replace(/\s+/g, '').toUpperCase()
    if (!/^KW/.test(postcode)) return null
    return {
      id: 'inject-sentinel-rural-grant',
      variant: 'card-compact',
      title: homeGrantTitle,
      journey_key: 'home',
      category: 'home',
      data: { money: '£9000', carbon: '1200 KG CO₂' },
      explanation: ['Efficiency over switching: rural heat grant detected for remote region eligibility.'],
      sourceLabel: 'SENTINEL',
      source: homeGrantOfferUrl,
      dominant_win: 'money',
      badge: 'grant',
      actions: { actionType: 'learn', learnUrl: homeGrantOfferUrl, actionUrl: homeGrantOfferUrl },
    }
  }, [homeGrantOfferUrl, homeGrantTitle, sentinel.grantFound, state.profile?.postcode])
  /** Keep live discovery injections first so newly generated cards always surface. */
  const effectiveInjectedTips = useMemo(
    () => [
      ...(sentinelGrantTipCard ? [sentinelGrantTipCard] : []),
      ...wickBehavioralTipCards,
      ...injectedTips,
      ...sentinelTipCards,
    ],
    [sentinelGrantTipCard, wickBehavioralTipCards, injectedTips, sentinelTipCards]
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
    if (!homeSentinelGrantActive) return
    setSentinelPingJourneyKeys((prev) => ({ ...prev, home: true }))
    const t = window.setTimeout(() => {
      setSentinelPingJourneyKeys((prev) => {
        const next = { ...prev }
        delete next.home
        return next
      })
    }, 520)
    return () => window.clearTimeout(t)
  }, [homeSentinelGrantActive, sentinel.lastRefreshed])

  useEffect(() => {
    if (!sentinelGrantTipCard) return
    setDiscoverySpringTipId(sentinelGrantTipCard.id)
    const t = window.setTimeout(() => {
      setDiscoverySpringTipId((id) => (id === sentinelGrantTipCard.id ? null : id))
    }, 720)
    return () => window.clearTimeout(t)
  }, [sentinelGrantTipCard])

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
      }
    } catch {
      //
    }
  }, [])

  // Allow page scroll when expanded (no body scroll lock)

  // Local Living: fetch council + regional carbon; postcode from localStorage (primary) or context (Wick KW1 default)
  useEffect(() => {
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('profile_postcode') : null
    const raw = (state.profile?.postcode ?? fromStorage)?.replace(/\s+/g, '').trim()
    const postcode = (raw && raw.length >= 4) ? raw : 'KW1'
    if (!postcode) {
      setLocalData(null)
      return
    }
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
  }, [state.profile?.postcode, setLocationState])

  useEffect(() => {
    if (!localJustLoaded) return
    const t = setTimeout(() => setLocalJustLoaded(false), 1200)
    return () => clearTimeout(t)
  }, [localJustLoaded])

  // Load scraped data from API so dashboard hero values use £/yr from 001 Crawler
  const profilePostcode = state.profile?.postcode

  const displayLocationName = useMemo(() => {
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('profile_postcode') : null
    const pcDisp = (profilePostcode ?? fromStorage ?? '').trim()
    return formatLocationDisplayName(localData ?? undefined, pcDisp)
  }, [localData, profilePostcode])

  const inPlacePhrase = displayLocationName.trim() ? `in ${displayLocationName.trim()}` : 'near you'

  useEffect(() => {
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('profile_postcode') : null
    const raw = (profilePostcode ?? fromStorage)?.replace(/\s+/g, '').trim()
    const postcode = raw && raw.length >= 4 ? raw : null
    const url = postcode ? `/api/scrape-sync?postcode=${encodeURIComponent(postcode)}` : '/api/scrape-sync'
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.scraped && Array.isArray(data.scraped)) {
          const map: Record<string, { scraped_at: string; carbon_value: number; money_value: number; deep_content_tip?: string; high_saving?: boolean }> = {}
          data.scraped.forEach((s: any) => {
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
      .catch(() => {})
  }, [profilePostcode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(UNLOCKED_COUNT_KEY, '9')
  }, [unlockedCount])

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
      setDiscoverySpringTipId(detail.id)
      window.setTimeout(() => setDiscoverySpringTipId((id) => (id === detail.id ? null : id)), 950)
      /* After POST /api/answers discovery race (Gemini + OpenClaw-backed pipelines): refresh batch + open new tip Solo Focus */
      void fetch('/api/zone/tips-refresh', { method: 'POST', credentials: 'include' }).catch(() => {})
      setRefreshKey((k) => k + 1)
      window.setTimeout(() => {
        setExpandedCardId(null)
        setExpandedFromTip(null)
        setExpandedTipId(detail.id)
      }, 420)
    }
    window.addEventListener(DISCOVERY_INJECT_EVENT, onInject)
    return () => window.removeEventListener(DISCOVERY_INJECT_EVENT, onInject)
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
    const storedCompleted: JourneyId[] =
      JSON.parse(localStorage.getItem('completedJourneys') || '[]')
    setCompletedJourneys(storedCompleted)
    setUnlockedCount((prev) => {
      const derived = Math.min(9, Math.max(3, 3 + storedCompleted.length))
      return Math.max(prev, derived)
    })
    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      const stored = localStorage.getItem(`journey_${journeyId}_answers`)
      if (stored) {
        try {
          journeyAnswers[journeyId] = JSON.parse(stored)
        } catch {
          journeyAnswers[journeyId] = {}
        }
      }
    })
    // Mechanical Pulse: profile from localStorage is primary source of truth (seed); context fills gaps
    const profileFromStorage =
      typeof window !== 'undefined'
        ? {
            name: localStorage.getItem('profile_name') ?? undefined,
            postcode: localStorage.getItem('profile_postcode') ?? undefined,
            household: localStorage.getItem('profile_household') ?? undefined,
            home_type: localStorage.getItem('profile_home_type') ?? undefined,
            transport_baseline: localStorage.getItem('profile_transport') ?? undefined,
            age: localStorage.getItem('profile_age') ?? undefined,
            employment_status: localStorage.getItem('profile_employment_status') ?? undefined,
          }
        : {}
    const profile = {
      ...profileFromStorage,
      name: state.profile?.name ?? profileFromStorage.name,
      postcode: state.profile?.postcode ?? profileFromStorage.postcode,
      household: state.profile?.livingSituation ?? profileFromStorage.household,
      home_type: state.profile?.homeType ?? profileFromStorage.home_type,
      transport_baseline: state.profile?.transport ?? profileFromStorage.transport_baseline,
      age: state.profile?.age ?? profileFromStorage.age,
      employment_status:
        state.profile?.employmentStatus?.trim() || profileFromStorage.employment_status,
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
      localData: localData ? { council: localData.council, localCarbonG: localData.localCarbonG } : undefined,
      injectedTips: effectiveInjectedTips,
    })
    setViewModel(vm)
    const money = parseMoneyGbpFromDisplay(vm?.hero?.data?.money ?? '0')
    const carbon = parseCarbonKgFromDisplay(vm?.hero?.data?.carbon ?? '0')
    setHeroTotals({ totalMoney: money, totalCarbon: carbon })
  }, [state.profile, scraped, localData, refreshKey, effectiveInjectedTips, setHeroTotals])

  /** Content Architect (Gemini): enrich nine category cards — cached per profile + answers + £/kg. */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      const stored = localStorage.getItem(`journey_${journeyId}_answers`)
      if (stored) {
        try {
          journeyAnswers[journeyId] = JSON.parse(stored)
        } catch {
          journeyAnswers[journeyId] = {}
        }
      }
    })
    const profileFromStorage = {
      name: localStorage.getItem('profile_name') ?? undefined,
      postcode: localStorage.getItem('profile_postcode') ?? undefined,
      household: localStorage.getItem('profile_household') ?? undefined,
      home_type: localStorage.getItem('profile_home_type') ?? undefined,
      transport_baseline: localStorage.getItem('profile_transport') ?? undefined,
      age: localStorage.getItem('profile_age') ?? undefined,
      employment_status: localStorage.getItem('profile_employment_status') ?? undefined,
    }
    const profile = {
      ...profileFromStorage,
      name: state.profile?.name ?? profileFromStorage.name,
      postcode: state.profile?.postcode ?? profileFromStorage.postcode,
      household: state.profile?.livingSituation ?? profileFromStorage.household,
      home_type: state.profile?.homeType ?? profileFromStorage.home_type,
      transport_baseline: state.profile?.transport ?? profileFromStorage.transport_baseline,
      age: state.profile?.age ?? profileFromStorage.age,
      employment_status:
        state.profile?.employmentStatus?.trim() || profileFromStorage.employment_status,
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
    }
    const cacheKey = `zz_architect_${architectCacheFingerprint(cachePayload)}`
    const skip = new Set<JourneyId>()
    if ((profile.postcode ?? '').replace(/\s+/g, '').toUpperCase().startsWith('KW')) {
      skip.add('home')
    }

    let cancelled = false
    const apply = (by: Partial<Record<JourneyId, ArchitectJourneyPayload>>) => {
      if (cancelled) return
      setViewModel((prev) => applyArchitectEnrichment(prev, by, { skipJourneys: skip }))
    }

    try {
      const hit = sessionStorage.getItem(cacheKey)
      if (hit) {
        apply(JSON.parse(hit) as Partial<Record<JourneyId, ArchitectJourneyPayload>>)
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
    })

    void (async () => {
      try {
        const res = await fetch('/api/zone/content-architect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards }),
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { byJourney?: Partial<Record<JourneyId, ArchitectJourneyPayload>> }
        const by = data.byJourney ?? {}
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(by))
        } catch {
          /* quota */
        }
        apply(by)
      } catch {
        /* offline / API */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state.profile, scraped, localData, refreshKey, effectiveInjectedTips])

  const groovyItems = getGroovyGridItems(viewModel)
  const displayItems: GroovyItem[] = useMemo(() => [...groovyItems], [groovyItems])

  const openNextJourneyFromExpanded = useCallback(
    (jid: JourneyId) => {
      const idx = WALL_JOURNEY_ORDER.indexOf(jid)
      for (let step = idx + 1; step < WALL_JOURNEY_ORDER.length; step++) {
        const nextKey = WALL_JOURNEY_ORDER[step]
        for (const c of displayItems) {
          if (c.type === 'journey' && c.item.journey_key === nextKey) {
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
    [displayItems],
  )

  const advanceToNextJourneyAfterAnswer = useCallback(
    ({ fromJourneyId, offerLine }: { fromJourneyId: JourneyId; offerLine: string }) => {
      const idx = WALL_JOURNEY_ORDER.indexOf(fromJourneyId)
      const nextKey =
        idx >= 0 && idx < WALL_JOURNEY_ORDER.length - 1 ? WALL_JOURNEY_ORDER[idx + 1] : null
      setExpandedCardId(null)
      setExpandedFromTip(null)
      setExpandedTipId(null)
      if (nextKey) {
        setAnswerHandoffOffer({ journeyKey: nextKey, line: offerLine })
        // Let the current solo-focus collapse finish before opening the next card.
        window.setTimeout(() => openNextJourneyFromExpanded(fromJourneyId), 280)
      } else {
        setAnswerHandoffOffer(null)
      }
    },
    [openNextJourneyFromExpanded],
  )

  /** Oversized slot-machine numbers: API totals + liked Rock habits (60-pool £/kg). */
  const heroMoneyNum = parseMoneyGbpFromDisplay(viewModel?.hero?.data?.money ?? '0')
  const heroCarbonNum = parseCarbonKgFromDisplay(viewModel?.hero?.data?.carbon ?? '0')
  const rockLikedImpact = sumRockLikedImpact(state.likedCards)
  const heroMoney = (state.heroTotals?.totalMoney ?? heroMoneyNum) + rockLikedImpact.money
  const heroCarbon = (state.heroTotals?.totalCarbon ?? heroCarbonNum) + rockLikedImpact.carbon
  const displayMoney = useCountUp(heroMoney, { duration: 920, spring: true })
  const displayCarbon = useCountUp(heroCarbon, { duration: 920, spring: true })

  return (
    <LayoutGroup>
      <motion.main
        className="zone relative min-h-screen overflow-x-hidden"
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
          className={`zone-anchor flex flex-col items-center pt-0 pb-0${isFocusViewOpen ? ' zone-focus-hidden' : ''}`}
          aria-hidden={isFocusViewOpen}
          variants={ZONE_ANCHOR_VARIANTS}
          initial="hidden"
          animate="visible"
        >
          <header className="zone-masthead flex items-start w-full px-4 flex-shrink-0">
            <div className="flex-1 min-w-0" aria-hidden>
              <span className="zone-menu">
                <span className="zone-menu-line">use less,</span>
                <span className="zone-menu-line">more.</span>
              </span>
            </div>
            <div className="flex-shrink-0 flex justify-center">
              <Logo width={66} className="zone-logo" style={{ color: 'var(--color-yellow)' }} />
            </div>
            <div className="flex-1 min-w-0" aria-hidden />
          </header>
          <h3 className="text-marvin text-center tracking-wide zz-anchor-greeting uppercase" style={{ color: 'var(--color-yellow)' }} aria-live="polite">
            {getZoneGreeting(
              state?.profile?.name,
              Array.isArray(completedJourneys) ? completedJourneys.length : 0,
              heroMoney,
              heroCarbon
            ).toUpperCase()}
          </h3>
          <div className="w-[90%] max-w-[400px] relative zone-ask-zai-wrap">
            <input
              type="text"
              placeholder="ASK ZAI..."
              className="zone-ask-zai-pill w-full h-[54px] rounded-full border-none px-8 text-marvin focus:ring-2 focus:ring-[var(--color-yellow)] focus:ring-offset-2 focus:ring-offset-[var(--color-purple)] uppercase caret-[var(--color-purple)]"
              onKeyDown={(e) => { if (e.key === 'Enter') router.push(ROUTES.ZAI) }}
              onClick={() => router.push(ROUTES.ZAI)}
              aria-label="Ask Zai — tap or press Enter to open chat"
            />
          </div>
        </motion.div>

        {/* 2. BENTO WALL — ClientOnly to avoid hydration mismatch (localStorage / window) */}
        <div className={`zone-container${isFocusViewOpen ? ' zone-focus-hidden' : ''}`} aria-hidden={isFocusViewOpen}>
          <ClientOnly fallback={<ZeroGateShutter />}>
          <motion.div
            layout
            data-testid="zone-grid-mounted"
            className={`groovy-zone-grid mx-auto ${localJustLoaded ? 'zone-grid-local-shiver' : ''}`}
            variants={{
              initial: {},
              animate: { transition: { staggerChildren: 0.08 } }
            }}
            initial="initial"
            animate="animate"
          >
            <AnimatePresence initial={false}>
            {displayItems.map((cell, i) => {
              const cellKey =
                cell.type === 'hero'
                  ? 'hero'
                  : cell.type === 'tip'
                    ? cell.tip.id
                    : cell.type === 'custom'
                      ? cell.id
                      : cell.type === 'general_question'
                        ? 'general-question'
                        : cell.item.id
              const isExpanded = cell.type === 'journey' && expandedCardId === cell.item.id
              const spanClass =
                cell.type === 'hero'
                  ? ''
                  : cell.type === 'general_question'
                    ? 'zone-grid-full-row'
                    : cell.type === 'tip'
                      ? ''
                      : cell.type === 'journey'
                        ? cell.persona === 'wide'
                          ? 'span-wide'
                          : cell.persona === 'tall'
                            ? 'span-tall'
                            : ''
                        : ''
              /* Hide other cells when a journey/tip card is expanded */
              const isHidden =
                cell.type === 'custom' || cell.type === 'general_question'
                  ? false
                  : (!!expandedCardId && !(cell.type === 'journey' && cell.item.id === expandedCardId)) ||
                    (!!expandedTipId && !(cell.type === 'tip' && cell.tip.id === expandedTipId))

              return (
                <motion.div
                  key={cellKey}
                  layout
                  layoutId={`kinetic-cell-${cellKey}`}
                  transition={SPRING_BLOOM}
                  variants={{
                    initial: { scale: 0.9, opacity: 0 },
                    animate: { scale: isHidden ? 0.9 : 1, opacity: isHidden ? 0 : 1 }
                  }}
                  className={`${spanClass} groovy-cell-radius`.trim() || 'groovy-cell-radius'}
                  style={{
                    willChange: 'transform',
                    pointerEvents: isHidden ? 'none' : 'auto',
                  }}
                >
                  {cell.type === 'hero' && (
                    <motion.div
                      layout
                      className="zone-hero-transparent relative flex flex-col justify-center items-stretch w-full h-full min-h-0 text-left"
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
                      <div className="w-full h-full flex flex-col">
                        <Link
                          href={ROUTES.SETTINGS}
                          data-testid="zone-hero-card"
                          className={`zone-hero-card bento-card-groovy block flex flex-col justify-between w-full h-full min-h-full cursor-pointer no-underline text-inherit${sentinelHeroPing ? ' sentinel-hero-ping' : ''}`}
                          style={{
                            color: 'var(--color-yellow)',
                            ['--color-ink' as string]: 'var(--color-yellow)',
                          }}
                        >
                          <div className="flex items-center justify-between w-full shrink-0">
                            <span className="card-top-label" style={{ color: 'var(--color-yellow)' }}>YOUR PROFILE</span>
                            <span className="card-top-arrow card-top-arrow--hint flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, color: 'currentColor', background: 'transparent' }} aria-hidden>
                              <svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 17L17 7M17 7H7M17 7v10" />
                              </svg>
                            </span>
                          </div>
                          <h2 className="card-headline m-0" lang="en" style={{ color: 'var(--color-yellow)' }}>Check out your stats</h2>
                          <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0 flex-shrink-0">
                            <div className="data-stack data-stack--tight">
                              <span className="data-label" style={{ color: 'var(--color-yellow)' }}>SAVE</span>
                              <span className="data-value data-stamp-metric sentinel-live-countup" style={{ color: 'var(--color-ink)' }}>
                                <StampedMoneyGbp gbp={displayMoney} />
                              </span>
                            </div>
                            <div className="data-stack data-stack--tight">
                              <span className="data-label" style={{ color: 'var(--color-yellow)' }}>CARBON</span>
                              <span className="data-value data-stamp-metric sentinel-live-countup" style={{ color: 'var(--color-ink)' }}>
                                <StampedCarbonKg kg={displayCarbon} />
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
                    const tipBg = getJourneyColorHex(tip.journey_key)
                    const tipTextColor = YELLOW_JOURNEY_IDS.includes(tip.journey_key) ? 'var(--color-purple)' : 'var(--color-yellow)'
                    const semanticWin = tip.dominant_win ?? 'money'
                    const tipLabelH = 14
                    const tipArrowSz = tipLabelH * 3
                    const tipHeadline = tip.title.split(/\s+/).slice(0, 5).join(' ')
                    const patch = tipDataPatches[tip.id]
                    const moneyDisp = (patch?.money ?? tip.data.money ?? '').replace(/^£\s*/, '').trim() || '0'
                    const carbonDisp = patch?.carbon ?? tip.data.carbon ?? '0'
                    const carbonKgNum = parseCarbonKgFromDisplay(carbonDisp)
                    const greenPulse = isDiscoveryInject && carbonKgNum > 500
                    const springBloomIn = discoverySpringTipId === tip.id
                    /* Expand the matching journey card so user gets full experience (tips, links, questions). */
                    const journeyCell = groovyItems.find((c): c is GroovyItem & { type: 'journey' } => c.type === 'journey' && c.item.journey_key === tip.journey_key)
                    const handleTipClick = () => {
                      /* Discovery injections: own Solo Focus + context trap; do not hijack journey tile expand. */
                      if (tip.id.startsWith('inject-')) {
                        setExpandedTipId(tip.id)
                        return
                      }
                      if (journeyCell) {
                        setExpandCard(
                          {
                            id: journeyCell.item.id,
                            title:
                              journeyCell.item.journey_key === 'home' && homeSentinelGrantActive
                                ? homeGrantTitle
                                : journeyCell.item.title,
                            journey_key: journeyCell.item.journey_key,
                            data: journeyCell.item.data,
                            explanation: journeyCell.item.explanation,
                            localCouncilTip: journeyCell.item.localCouncilTip,
                            source: journeyCell.item.source,
                            sourceLabel: journeyCell.item.sourceLabel,
                            actions:
                              journeyCell.item.journey_key === 'home' && homeSentinelGrantActive
                                ? { ...(journeyCell.item.actions ?? {}), actionUrl: homeGrantOfferUrl, learnUrl: homeGrantOfferUrl }
                                : journeyCell.item.actions,
                          },
                          'zone'
                        )
                        setExpandedCardId(journeyCell.item.id)
                        setExpandedFromTip(tip)
                      } else {
                        setExpandedTipId(tip.id)
                      }
                    }
                    return (
                      <motion.button
                        type="button"
                        layout
                        className={`bento-card-groovy flex flex-col justify-between w-full h-full cursor-pointer border-0 text-left${greenPulse ? ' discovery-card-green-pulse' : ''}`}
                        style={{
                          backgroundColor: tipBg,
                          color: tipTextColor,
                          borderRadius: 60,
                          boxShadow: 'none',
                          ['--color-ink' as string]: tipTextColor,
                          ['--semantic-money' as string]: semanticWin === 'money' ? 'var(--color-yellow)' : tipTextColor,
                          ['--semantic-carbon' as string]: semanticWin === 'carbon' ? 'var(--color-pink)' : tipTextColor,
                        }}
                        onClick={handleTipClick}
                        initial={springBloomIn || isDiscoveryInject ? { scale: 0.88, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        whileTap={{ scale: 0.96 }}
                        transition={SPRING_BLOOM}
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
                        <h2 className="card-headline m-0" lang="en" style={{ color: tipTextColor }}>
                          {tipHeadline}
                        </h2>
                        <div className="card-impact-grid grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-0">
                          <div className="data-stack data-stack--tight">
                            <span className="data-label" style={{ color: tipTextColor }}>SAVE</span>
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
                            <span className="data-label" style={{ color: tipTextColor }}>CARBON</span>
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
                    <motion.div
                      layout
                      initial={cell.index === popInIndex ? { scale: 0, opacity: 0 } : { scale: 0, rotate: -5 }}
                      animate={
                        sentinelPingJourneyKeys[cell.item.journey_key] ||
                        (sentinel.gridLowPulse && cell.item.journey_key === 'carbon')
                          ? { opacity: [0, 1], x: [-10, 0], skewX: [10, 0], scale: 1, rotate: 0 }
                          : { scale: 1, rotate: 0, opacity: 1, x: 0, skewX: 0 }
                      }
                      transition={
                        cell.index === popInIndex
                          ? { type: 'spring' as const, stiffness: 500, damping: 22 }
                          : sentinelPingJourneyKeys[cell.item.journey_key] ||
                              (sentinel.gridLowPulse && cell.item.journey_key === 'carbon')
                            ? { type: "spring", stiffness: 600, damping: 30 }
                            : SPRING_BLOOM
                      }
                      className="w-full h-full min-h-0"
                      id={`zone-journey-${cell.item.journey_key}`}
                    >
                    <JourneyBentoCard
                      journeyId={cell.item.journey_key}
                      title={
                        expandedFromTip?.journey_key === cell.item.journey_key
                          ? expandedFromTip.title
                          : cell.item.journey_key === 'home' && homeSentinelGrantActive
                            ? homeGrantTitle
                            : cell.item.title
                      }
                      isTall={cell.persona === 'tall'}
                      textColorOverride={YELLOW_JOURNEY_IDS.includes(cell.item.journey_key) ? 'var(--color-purple)' : 'var(--color-yellow)'}
                      carbonValue={expandedFromTip?.journey_key === cell.item.journey_key && (expandedFromTip.data?.carbon ?? '') ? expandedFromTip.data.carbon : cell.item.data.carbon}
                      moneyValue={expandedFromTip?.journey_key === cell.item.journey_key && (expandedFromTip.data?.money ?? '') ? expandedFromTip.data.money : cell.item.data.money}
                      carbonKg={cell.item.carbonKg}
                      moneyGbp={cell.item.moneyGbp}
                      isComplete={completedJourneys.includes(cell.item.journey_key)}
                      onRefineQuestions={undefined}
                      onActionClick={() => {
                        setExpandCard(
                          {
                            id: cell.item.id,
                            title:
                              cell.item.journey_key === 'home' && homeSentinelGrantActive
                                ? homeGrantTitle
                                : cell.item.title,
                            journey_key: cell.item.journey_key,
                            data: cell.item.data,
                            explanation: cell.item.explanation,
                            localCouncilTip: cell.item.localCouncilTip,
                            source: cell.item.source,
                            sourceLabel: cell.item.sourceLabel,
                            actions:
                              cell.item.journey_key === 'home' && homeSentinelGrantActive
                                ? { ...(cell.item.actions ?? {}), actionUrl: homeGrantOfferUrl, learnUrl: homeGrantOfferUrl }
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
                        return place && localData?.council
                          ? `In ${place}, you are currently eligible for the Boiler Upgrade Scheme (£7,500). Your local grid is running at ${localData.localCarbonG ?? '—'}g CO₂e/kWh.`
                          : undefined
                      })()}
                      claimOfferUrl={
                        cell.item.journey_key === 'home' && homeSentinelGrantActive
                          ? homeGrantOfferUrl
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
                      groovy
                      kineticGrid
                      isExpanded={expandedCardId === cell.item.id}
                      onExpand={() => {
                        if (answerHandoffOffer && answerHandoffOffer.journeyKey !== cell.item.journey_key) {
                          setAnswerHandoffOffer(null)
                        }
                        setExpandCard(
                          {
                            id: cell.item.id,
                            title:
                              cell.item.journey_key === 'home' && homeSentinelGrantActive
                                ? homeGrantTitle
                                : cell.item.title,
                            journey_key: cell.item.journey_key,
                            data: cell.item.data,
                            explanation: cell.item.explanation,
                            localCouncilTip: cell.item.localCouncilTip,
                            source: cell.item.source,
                            sourceLabel: cell.item.sourceLabel,
                            actions:
                              cell.item.journey_key === 'home' && homeSentinelGrantActive
                                ? { ...(cell.item.actions ?? {}), actionUrl: homeGrantOfferUrl, learnUrl: homeGrantOfferUrl }
                                : cell.item.actions,
                          },
                          'zone'
                        )
                        setExpandedCardId(cell.item.id)
                        setExpandedFromTip(null)
                      }}
                      onClose={() => {
                        setExpandedCardId(null)
                        setExpandedFromTip(null)
                        setAnswerHandoffOffer(null)
                      }}
                      cardId={cell.item.id}
                      onLike={(id, title, savings) => toggleLike(id, title, savings)}
                      isLiked={state.likedCards.includes(cell.item.id)}
                      learnUrl={cell.item.actions?.learnUrl}
                      onAskZai={() => router.push(ROUTES.ZAI)}
                      onJourneyAnswered={() => {
                        setRefreshKey((k) => k + 1)
                        setUnlockedCount((prev) => Math.min(prev + 1, 9))
                        setPopInIndex(cell.index)
                        window.setTimeout(() => setPopInIndex(null), 850)
                      }}
                      onSoloEmbedComplete={(jid) => {
                        const idx = WALL_JOURNEY_ORDER.indexOf(jid)
                        const nextIdx = idx >= 0 && idx < WALL_JOURNEY_ORDER.length - 1 ? idx + 1 : null
                        if (nextIdx !== null) setPopInIndex(nextIdx)
                        window.requestAnimationFrame(() => {
                          window.setTimeout(() => {
                            document.getElementById(`zone-journey-${jid}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            })
                          }, 450)
                        })
                        if (nextIdx !== null) {
                          window.setTimeout(() => setPopInIndex(null), 800)
                        }
                      }}
                      onSwipeNextJourney={openNextJourneyFromExpanded}
                      onAdvanceToNextJourneyAfterAnswer={advanceToNextJourneyAfterAnswer}
                    />
                    </motion.div>
                  )}
                  {cell.type === 'custom' && (
                    <motion.div
                      layout
                      className="bento-card-groovy flex flex-col justify-between w-full h-full border-0 text-left"
                      style={{
                        backgroundColor: 'var(--color-purple)',
                        color: 'var(--color-yellow)',
                        borderRadius: 60,
                        boxShadow: 'none',
                      }}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="flex items-center justify-between w-full shrink-0">
                        <span className="card-top-label" style={{ color: 'var(--color-yellow)' }}>YOUR GOAL</span>
                        <span className="card-top-arrow card-top-arrow--hint flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, color: 'currentColor', background: 'transparent' }} aria-hidden>
                          <svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17L17 7M17 7H7M17 7v10" />
                          </svg>
                        </span>
                      </div>
                      <h2 className="card-headline m-0" lang="en" style={{ color: 'var(--color-yellow)' }}>
                        {cell.headline}
                      </h2>
                    </motion.div>
                  )}
                  {cell.type === 'general_question' && (
                    <motion.div
                      layout
                      className="flex flex-col items-center justify-center gap-4 sm:gap-6 w-full py-6 px-4 text-center"
                      style={{ color: 'var(--color-yellow)' }}
                    >
                      <h4
                        className="text-marvin uppercase m-0"
                        style={{
                          fontFamily: 'var(--font-marvin)',
                          fontWeight: 700,
                          fontSize: 'var(--zz-h4-mobile)',
                          color: 'var(--color-yellow)',
                        }}
                      >
                        What would you like to work on?
                      </h4>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 16,
                          justifyContent: 'center',
                          maxWidth: 420,
                        }}
                      >
                        {GOAL_OPTIONS.map((opt) => (
                          <motion.button
                            key={opt}
                            type="button"
                            aria-label={opt}
                            onClick={() => {
                              setCustomCards((prev) => [...prev, { id: `custom-${Date.now()}`, headline: opt }])
                            }}
                            style={{
                              width: 100,
                              height: 100,
                              minWidth: 100,
                              borderRadius: 9999,
                              border: 'none',
                              fontFamily: 'var(--font-marvin)',
                              fontWeight: 700,
                              fontSize: 'var(--zz-h4-mobile)',
                              lineHeight: 'var(--zz-lh-heading)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              background: 'var(--color-yellow)',
                              color: 'var(--color-purple)',
                              padding: 8,
                              textAlign: 'center',
                            }}
                            whileTap={{ scale: 0.96 }}
                            transition={SPRING_TAP}
                          >
                            {opt}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.div>
          </ClientOnly>
        </div>

        {/* The Rock — directly under Groovy Grid. */}
        {!expandedCardId && !expandedTipId && (
          <ClientOnly fallback={null}>
            <div className="w-full mt-8 mb-24">
              <RockSavingTips
                habits={rockVisibleHabits}
                likedCardIds={state.likedCards}
                onOpenTip={(id) => setExpandedTipId(id)}
              />
            </div>
          </ClientOnly>
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
          const offerUrl = tip.cta?.url || tip.actions?.actionUrl || tip.actions?.learnUrl || tip.source
          return (
            <AnimatePresence mode="wait">
              <SoloFocusOverlay
                key={tip.id}
                category={(tip.journey_key || 'TIP').replace(/-/g, ' ')}
                recommendation={tip.title.split(/\s+/).slice(0, 6).join(' ')}
                insight={tip.explanation?.[0] ?? undefined}
                moneyValue={tip.data.money || '£0'}
                carbonValue={tip.data.carbon || '0 KG CO₂'}
                offerUrl={offerUrl}
                sourceUrl={tip.source || tip.actions?.learnUrl}
                sourceLabel={tip.sourceLabel}
                architectSuppliedBy={tip.architectSuppliedBy}
                onClose={() => setExpandedTipId(null)}
                onAskZai={() => router.push(ROUTES.ZAI)}
                cardId={tip.id}
                onLike={(id, title, savings) => toggleLike(id, title, savings)}
                onEmbeddedAnswerSuccess={
                  isRockTip && tip.id.startsWith('rock-')
                    ? () => {
                        const slug = tip.id.replace(/^rock-/, '')
                        const nextHabit = replaceRockSlotAfterLike(slug, state.likedCards)
                        setRockRefreshKey((k) => k + 1)
                        if (nextHabit) setExpandedTipId(rockCardId(nextHabit.slug))
                        else setExpandedTipId(null)
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
              />
            </AnimatePresence>
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
        <div
          className="sentinel-brain-label"
          aria-live="polite"
          style={{ color: sentinel.pulseColor ?? 'var(--color-yellow)' }}
        >
          Sentinel Brain: Active | Skill: Live-Impact v1.0
        </div>
      </motion.main>
    </LayoutGroup>
  )
}
