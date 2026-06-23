'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { UNIFIED_PROFILE_MEMORY_EVENT, persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import { guardLegacyDemoIdentityOnClient } from '@/lib/zone/garyMode'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ensureProfileSession } from '@/lib/client/ensureProfileSession'
import { removeLikeCardSnapshot } from '@/lib/client/likeCardSnapshots'
import { readDislikedCardIds, recordOfferSignal, writeDislikedCardIds, OFFER_PREFERENCE_CHANGED_EVENT } from '@/lib/zone/offerSignals'
import {
  readIndifferentCardIds,
  saveIndifferentCardSnapshot,
  writeIndifferentCardIds,
} from '@/lib/client/indifferentCardSnapshots'
import {
  readAllDislikeCardSnapshots,
  removeDislikeCardSnapshot,
  saveDislikeCardSnapshot,
} from '@/lib/client/dislikeCardSnapshots'
import type { LocalIntelligence } from '@/lib/local/getLocalData'

/** Age persona for tips: Junior | Adult (MID) | Retired */
export type ProfileAge = 'JUNIOR' | 'MID' | 'RETIRED'

export interface AppProfile {
  name: string
  postcode: string
  /** Optional — disambiguates EPC register rows at the same postcode. */
  houseNumber?: string
  livingSituation: string
  homeType: string
  /** GAS | ELECTRIC | MIX | OTHER — leading profile question for utilities tile. */
  homePower?: string
  transport: string
  age: string
  /** EMPLOYED | SELF_EMPLOYED | UNEMPLOYED — set in onboarding step before goal */
  employmentStatus?: string
  goal: string
}

/** Hero totals returned from POST /api/answers for synchronous UI update (no refetch). */
export interface HeroTotals {
  totalMoney: number
  totalCarbon: number
}

const HERO_TOTALS_KEY = 'heroTotals'
const LOCATION_STATE_KEY = 'zz_location_state_v1'
const V23_FIRST_LOAD_KEY = 'zz_v23_first_load_done'

function readHeroTotalsFromStorage(): HeroTotals | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(HERO_TOTALS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { totalMoney?: unknown; totalCarbon?: unknown }
    const totalMoney = typeof parsed.totalMoney === 'number' ? parsed.totalMoney : Number(parsed.totalMoney)
    const totalCarbon = typeof parsed.totalCarbon === 'number' ? parsed.totalCarbon : Number(parsed.totalCarbon)
    if (!Number.isFinite(totalMoney) || !Number.isFinite(totalCarbon)) return null
    return { totalMoney, totalCarbon }
  } catch {
    return null
  }
}

export function readLocationStateFromStorage(): { locationName: string; local: LocalIntelligence | null } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCATION_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { locationName?: unknown; local?: LocalIntelligence | null }
    if (typeof parsed.locationName !== 'string' || !parsed.locationName.trim()) return null
    return { locationName: parsed.locationName.trim(), local: parsed.local ?? null }
  } catch {
    return null
  }
}

export interface AppState {
  profile: AppProfile | null
  likedCards: string[]
  dislikedCards: string[]
  indifferentCardIds: string[]
  userId: string | null
  /** Set from API response on answer submit; zone hero uses this for instant update. */
  heroTotals: HeroTotals | null
  /** Journey answers mirrored from `journey_{id}_answers` for Solo Focus + Zai bias without re-parsing storage in every card. */
  journeyAnswers: Record<JourneyId, Record<string, string>>
  /** Reverse-lookup location identity used as primary context key for local grant prioritization. */
  locationState: {
    locationName: string
    local: LocalIntelligence | null
  } | null
  soloFocus: {
    activeCardId: string | null
    activeType: 'journey' | 'tip' | 'discovery' | null
  }
}

interface AppContextValue {
  state: AppState
  setUserId: (userId: string | null) => void
  toggleLike: (cardId: string, cardTitle?: string, savings?: number) => void
  toggleDislike: (
    cardId: string,
    cardTitle?: string,
    savings?: number,
    journeyKey?: string
  ) => void
  refreshProfile: () => void
  setHeroTotals: (totals: HeroTotals | null) => void
  setLocationState: (next: { locationName: string; local: LocalIntelligence | null } | null) => void
  openSoloFocus: (cardId: string, type: 'journey' | 'tip' | 'discovery') => boolean
  closeSoloFocus: () => void
}

function readJourneyAnswersFromStorage(): Record<JourneyId, Record<string, string>> {
  const out = {} as Record<JourneyId, Record<string, string>>
  if (typeof window === 'undefined') return out
  for (const jid of JOURNEY_ORDER) {
    try {
      const raw = localStorage.getItem(`journey_${jid}_answers`)
      out[jid] = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      out[jid] = {}
    }
  }
  return out
}

function readProfileFromStorage(): AppProfile | null {
  if (typeof window === 'undefined') return null
  const name = localStorage.getItem('profile_name') ?? ''
  const postcode = localStorage.getItem('profile_postcode') ?? ''
  const houseNumber = localStorage.getItem('profile_house_number') ?? ''
  const livingSituation = localStorage.getItem('profile_household') ?? ''
  const homeType = localStorage.getItem('profile_home_type') ?? ''
  const homePower = localStorage.getItem('profile_home_power') ?? ''
  const transport = localStorage.getItem('profile_transport') ?? ''
  const age = localStorage.getItem('profile_age') ?? ''
  const employmentStatus = localStorage.getItem('profile_employment_status') ?? ''
  const goal = localStorage.getItem('profile_goal') ?? ''
  if (!name && !postcode && !livingSituation && !homeType && !transport && !age && !goal) return null
  return {
    name,
    postcode,
    houseNumber: houseNumber || undefined,
    livingSituation,
    homeType,
    homePower: homePower || undefined,
    transport,
    age,
    employmentStatus: employmentStatus || undefined,
    goal,
  }
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [likedCards, setLikedCards] = useState<string[]>([])
  const [dislikedCards, setDislikedCards] = useState<string[]>(() =>
    typeof window !== 'undefined' ? readDislikedCardIds() : []
  )
  const [indifferentCardIds, setIndifferentCardIds] = useState<string[]>(() =>
    typeof window !== 'undefined' ? readIndifferentCardIds() : []
  )
  const [userId, setUserIdState] = useState<string | null>(null)
  const [heroTotals, setHeroTotalsState] = useState<HeroTotals | null>(null)
  const [locationState, setLocationStateState] = useState<{ locationName: string; local: LocalIntelligence | null } | null>(null)
  const [soloFocus, setSoloFocus] = useState<{
    activeCardId: string | null
    activeType: 'journey' | 'tip' | 'discovery' | null
  }>({
    activeCardId: null,
    activeType: null,
  })
  const [journeyAnswers, setJourneyAnswers] = useState<Record<JourneyId, Record<string, string>>>(
    () => ({}) as Record<JourneyId, Record<string, string>>
  )
  const [lastPostcodeSynced, setLastPostcodeSynced] = useState<string>('')

  const refreshProfile = useCallback(() => {
    setProfile(readProfileFromStorage())
    setJourneyAnswers(readJourneyAnswersFromStorage())
  }, [])

  useEffect(() => {
    guardLegacyDemoIdentityOnClient()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(V23_FIRST_LOAD_KEY)) {
      try {
        const keysToDelete: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key) continue
          if (
            key.startsWith('profile_') ||
            key.startsWith('journey_') ||
            key.startsWith('zz_') ||
            key === HERO_TOTALS_KEY ||
            key === 'userId' ||
            key === 'user_id'
          ) {
            keysToDelete.push(key)
          }
        }
        keysToDelete.forEach((k) => localStorage.removeItem(k))
        localStorage.setItem(V23_FIRST_LOAD_KEY, '1')
      } catch {
        // ignore storage lock/quota failures
      }
    }
    refreshProfile()
    setJourneyAnswers(readJourneyAnswersFromStorage())
    if (typeof window !== 'undefined') {
      const hasSession =
        typeof document !== 'undefined' &&
        document.cookie.split(';').some((c) => c.trim().startsWith('session='))
      if (hasSession) {
        void fetch('/api/user', { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            const id = data?.user?.id
            if (typeof id === 'string' && id.trim()) setUserIdState(id.trim())
          })
          .catch(() => {})
      }
      const cachedTotals = readHeroTotalsFromStorage()
      if (cachedTotals) setHeroTotalsState(cachedTotals)
      const cachedLocation = readLocationStateFromStorage()
      if (cachedLocation) setLocationStateState(cachedLocation)
    }
  }, [refreshProfile])

  /** Database-first: merge Neon `journey_answers_jsonb` into client state + localStorage for Zone. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasSessionCookie =
      typeof document !== 'undefined' &&
      document.cookie.split(';').some((c) => c.trim().startsWith('session='))
    if (!hasSessionCookie) return
    let cancelled = false
    fetch('/api/answers', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.answers || typeof data.answers !== 'object') return
        const serverMap = data.answers as Record<string, Record<string, string>>
        const merged: Record<JourneyId, Record<string, string>> = {
          ...readJourneyAnswersFromStorage(),
        }
        for (const jid of JOURNEY_ORDER) {
          const srv = serverMap[jid]
          if (!srv || typeof srv !== 'object') continue
          merged[jid] = { ...(merged[jid] ?? {}), ...srv }
          try {
            localStorage.setItem(`journey_${jid}_answers`, JSON.stringify(merged[jid]))
          } catch {
            // ignore quota
          }
        }
        setJourneyAnswers(merged)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMemory = () => {
      setProfile(readProfileFromStorage())
      setJourneyAnswers(readJourneyAnswersFromStorage())
    }
    window.addEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onMemory)
    return () => window.removeEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onMemory)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const postcode = (profile?.postcode ?? '').trim().toUpperCase()
    if (!postcode || postcode === lastPostcodeSynced) return
    setLastPostcodeSynced(postcode)
    persistUnifiedUserProfileMemory()
  }, [profile?.postcode, lastPostcodeSynced])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!heroTotals) {
      localStorage.removeItem(HERO_TOTALS_KEY)
      return
    }
    localStorage.setItem(HERO_TOTALS_KEY, JSON.stringify(heroTotals))
  }, [heroTotals])

  useEffect(() => {
    const syncPrefs = () => {
      setDislikedCards(readDislikedCardIds())
      setIndifferentCardIds(readIndifferentCardIds())
    }
    window.addEventListener(OFFER_PREFERENCE_CHANGED_EVENT, syncPrefs)
    return () => window.removeEventListener(OFFER_PREFERENCE_CHANGED_EVENT, syncPrefs)
  }, [])

  useEffect(() => {
    fetch('/api/likes', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { liked_card_ids: [] }))
      .then((data) => setLikedCards(Array.isArray(data?.liked_card_ids) ? data.liked_card_ids : []))
      .catch(() => setLikedCards([]))
    fetch('/api/offer-signals', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { disliked_card_ids: [], indifferent_card_ids: [] }))
      .then((data) => {
        const disliked = Array.isArray(data?.disliked_card_ids) ? data.disliked_card_ids : []
        const indifferent = Array.isArray(data?.indifferent_card_ids) ? data.indifferent_card_ids : []
        setDislikedCards(disliked)
        setIndifferentCardIds(indifferent)
        writeDislikedCardIds(disliked)
        writeIndifferentCardIds(indifferent)
        for (const snap of data?.dislike_snapshots ?? []) {
          if (snap?.id && snap?.journey_key) {
            saveDislikeCardSnapshot({
              id: String(snap.id),
              journey_key: String(snap.journey_key) as JourneyId,
              title: String(snap.title ?? ''),
            })
          }
        }
        for (const snap of data?.indifferent_snapshots ?? []) {
          if (snap?.id && snap?.journey_key) {
            saveIndifferentCardSnapshot({
              id: String(snap.id),
              journey_key: String(snap.journey_key) as JourneyId,
              title: String(snap.title ?? ''),
            })
          }
        }
      })
      .catch(() => {
        setDislikedCards(readDislikedCardIds())
        setIndifferentCardIds(readIndifferentCardIds())
      })
  }, [userId])

  const toggleLike = useCallback((cardId: string, cardTitle?: string, savings?: number) => {
    let wasLiked = false
    setLikedCards((prev) => {
      wasLiked = prev.includes(cardId)
      return wasLiked ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    })
    if (!wasLiked) {
      setDislikedCards((prev) => {
        const next = prev.filter((id) => id !== cardId)
        writeDislikedCardIds(next)
        return next
      })
    }

    void (async () => {
      await ensureProfileSession()
      try {
        const res = await fetch('/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ card_id: cardId, card_title: cardTitle, savings }),
        })
        if (!res.ok) {
          setLikedCards((prev) =>
            wasLiked
              ? prev.includes(cardId)
                ? prev
                : [...prev, cardId]
              : prev.filter((id) => id !== cardId)
          )
          return
        }
        const data = (await res.json().catch(() => ({}))) as { liked?: boolean }
        if (data.liked === false) removeLikeCardSnapshot(cardId)
      } catch {
        setLikedCards((prev) =>
          wasLiked
            ? prev.includes(cardId)
              ? prev
              : [...prev, cardId]
            : prev.filter((id) => id !== cardId)
        )
      }
    })()
  }, [])

  const toggleDislike = useCallback(
    (cardId: string, cardTitle?: string, savings?: number, journeyKey?: string) => {
      let wasDisliked = false
      setDislikedCards((prev) => {
        wasDisliked = prev.includes(cardId)
        const next = wasDisliked ? prev.filter((id) => id !== cardId) : [...prev, cardId]
        writeDislikedCardIds(next)
        return next
      })
      if (!wasDisliked) {
        setLikedCards((prev) => prev.filter((id) => id !== cardId))
        removeLikeCardSnapshot(cardId)
        if (journeyKey) {
          saveDislikeCardSnapshot({
            id: cardId,
            journey_key: journeyKey.replace(/^journey-/, '') as JourneyId,
            title: cardTitle ?? cardId,
          })
        }
      } else {
        removeDislikeCardSnapshot(cardId)
      }

      void (async () => {
        await ensureProfileSession()
        if (wasDisliked) return
        recordOfferSignal({
          card_id: cardId,
          signal: 'dislike',
          card_title: cardTitle,
          money_gbp: savings,
          journey_key: journeyKey,
        })
      })()
    },
    []
  )

  const setUserId = useCallback((id: string | null) => {
    setUserIdState(id)
    if (id) {
      fetch('/api/likes', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { liked_card_ids: [] }))
        .then((data) => setLikedCards(Array.isArray(data?.liked_card_ids) ? data.liked_card_ids : []))
        .catch(() => setLikedCards([]))
    } else {
      setLikedCards([])
    }
  }, [])

  const setHeroTotals = useCallback((totals: HeroTotals | null) => {
    setHeroTotalsState(totals)
  }, [])

  const setLocationState = useCallback((next: { locationName: string; local: LocalIntelligence | null } | null) => {
    setLocationStateState(next)
    if (typeof window === 'undefined') return
    try {
      if (!next || !next.locationName.trim()) {
        localStorage.removeItem(LOCATION_STATE_KEY)
        return
      }
      localStorage.setItem(LOCATION_STATE_KEY, JSON.stringify(next))
    } catch {
      // ignore privacy/quota issues
    }
  }, [])

  const openSoloFocus = useCallback((cardId: string, type: 'journey' | 'tip' | 'discovery'): boolean => {
    setSoloFocus({ activeCardId: cardId, activeType: type })
    trackFunnelEvent('solo_focus_open', { card_id: cardId, card_type: type })
    return true
  }, [])

  const closeSoloFocus = useCallback(() => {
    setSoloFocus((prev) => {
      if (prev.activeCardId) {
        trackFunnelEvent('solo_focus_close', {
          card_id: prev.activeCardId,
          card_type: prev.activeType ?? undefined,
        })
      }
      return { activeCardId: null, activeType: null }
    })
  }, [])

  const state: AppState = useMemo(
    () => ({
      profile,
      likedCards,
      dislikedCards,
      indifferentCardIds,
      userId,
      heroTotals,
      journeyAnswers,
      locationState,
      soloFocus,
    }),
    [profile, likedCards, dislikedCards, indifferentCardIds, userId, heroTotals, journeyAnswers, locationState, soloFocus]
  )

  const value: AppContextValue = useMemo(
    () => ({
      state,
      setUserId,
      toggleLike,
      toggleDislike,
      refreshProfile,
      setHeroTotals,
      setLocationState,
      openSoloFocus,
      closeSoloFocus,
    }),
    [state, setUserId, toggleLike, toggleDislike, refreshProfile, setHeroTotals, setLocationState, openSoloFocus, closeSoloFocus]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
