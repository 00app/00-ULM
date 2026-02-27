'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

/** Age persona for tips: Junior (tech, food) vs Retired (home, holidays) */
export type ProfileAge = 'JUNIOR' | 'MID' | 'RETIRED'

interface ProfileData {
  id?: string
  name: string
  postcode: string
  livingSituation: string
  homeType: string
  transport: string
  age?: ProfileAge
}

interface AppState {
  profile: ProfileData | null
  userId: string | null
  likedCards: string[]
  currentScreen: string
}

interface AppContextType {
  state: AppState
  setProfile: (profile: ProfileData) => void
  setUserId: (userId: string) => void
  toggleLike: (cardId: string) => void
  setCurrentScreen: (screen: string) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    profile: null,
    userId: null,
    likedCards: [],
    currentScreen: 'intro',
  })

  const setProfile = (profile: ProfileData) => {
    setState((prev) => ({ ...prev, profile, userId: profile.id || null }))
  }

  const setUserId = (userId: string) => {
    setState((prev) => ({ ...prev, userId }))
  }

  const toggleLike = (cardId: string) => {
    setState((prev) => ({
      ...prev,
      likedCards: prev.likedCards.includes(cardId)
        ? prev.likedCards.filter((id) => id !== cardId)
        : [...prev.likedCards, cardId],
    }))
  }

  const setCurrentScreen = (screen: string) => {
    setState((prev) => ({ ...prev, currentScreen: screen }))
  }

  return (
    <AppContext.Provider value={{ state, setProfile, setUserId, toggleLike, setCurrentScreen }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
