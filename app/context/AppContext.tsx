'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { UNIFIED_PROFILE_MEMORY_EVENT, persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import type { LocalIntelligence } from '@/lib/local/getLocalData'

/** Age persona for tips: Junior | Adult (MID) | Retired */
export type ProfileAge = 'JUNIOR' | 'MID' | 'RETIRED'

export interface AppProfile {
  name: string
  postcode: string
  livingSituation: string
  homeType: string
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

function readLocationStateFromStorage(): { locationName: string; local: LocalIntelligence | null } | null {
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
  const livingSituation = localStorage.getItem('profile_household') ?? ''
  const homeType = localStorage.getItem('profile_home_type') ?? ''
  const transport = localStorage.getItem('profile_transport') ?? ''
  const age = localStorage.getItem('profile_age') ?? ''
  const employmentStatus = localStorage.getItem('profile_employment_status') ?? ''
  const goal = localStorage.getItem('profile_goal') ?? ''
  if (!name && !postcode && !livingSituation && !homeType && !transport && !age && !goal) return null
  return { name, postcode, livingSituation, homeType, transport, age, employmentStatus: employmentStatus || undefined, goal }
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [likedCards, setLikedCards] = useState<string[]>([])
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
  const [journeyAnswers, setJourneyAnswers] = useState<Record<JourneyId, Record<string, string>>>(() =>
    typeof window === 'undefined' ? ({} as Record<JourneyId, Record<string, string>>) : readJourneyAnswersFromStorage()
  )
  const [lastPostcodeSynced, setLastPostcodeSynced] = useState<string>('')

  const refreshProfile = useCallback(() => {
    setProfile(readProfileFromStorage())
    setJourneyAnswers(readJourneyAnswersFromStorage())
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
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('userId') ?? localStorage.getItem('user_id')
      if (id) setUserIdState(id)
      const cachedTotals = readHeroTotalsFromStorage()
      if (cachedTotals) setHeroTotalsState(cachedTotals)
      const cachedLocation = readLocationStateFromStorage()
      if (cachedLocation) setLocationStateState(cachedLocation)
    }
  }, [refreshProfile])

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
    fetch('/api/likes', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { liked_card_ids: [] }))
      .then((data) => setLikedCards(Array.isArray(data?.liked_card_ids) ? data.liked_card_ids : []))
      .catch(() => setLikedCards([]))
  }, [userId])

  const toggleLike = useCallback((cardId: string, cardTitle?: string, savings?: number) => {
    setLikedCards((prev) => {
      const next = prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ card_id: cardId, card_title: cardTitle, savings: savings }),
      }).catch(() => {})
      return next
    })
  }, [])

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
    let accepted = false
    setSoloFocus((prev) => {
      // Anti-double-focus guard: once open, block second mount attempts.
      if (prev.activeCardId && prev.activeCardId !== cardId) {
        return prev
      }
      accepted = true
      return { activeCardId: cardId, activeType: type }
    })
    return accepted
  }, [])

  const closeSoloFocus = useCallback(() => {
    setSoloFocus({ activeCardId: null, activeType: null })
  }, [])

  const state: AppState = useMemo(
    () => ({ profile, likedCards, userId, heroTotals, journeyAnswers, locationState, soloFocus }),
    [profile, likedCards, userId, heroTotals, journeyAnswers, locationState, soloFocus]
  )

  const value: AppContextValue = useMemo(
    () => ({
      state,
      setUserId,
      toggleLike,
      refreshProfile,
      setHeroTotals,
      setLocationState,
      openSoloFocus,
      closeSoloFocus,
    }),
    [state, setUserId, toggleLike, refreshProfile, setHeroTotals, setLocationState, openSoloFocus, closeSoloFocus]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
