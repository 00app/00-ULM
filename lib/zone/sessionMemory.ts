import type { JourneyId } from '@/lib/journeys'

export const SESSION_MEMORY_KEY = 'zz_session_memory'

export type ZoneSessionMemory = {
  last_route: 'zone' | 'zai' | 'likes'
  last_solo_focus?: {
    cardId: string
    journeyId: JourneyId
    at: string
  }
}

export function readSessionMemory(): ZoneSessionMemory | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_MEMORY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ZoneSessionMemory
  } catch {
    return null
  }
}

export function writeSessionMemory(patch: Partial<ZoneSessionMemory>): void {
  if (typeof window === 'undefined') return
  const prev = readSessionMemory() ?? { last_route: 'zone' as const }
  try {
    sessionStorage.setItem(
      SESSION_MEMORY_KEY,
      JSON.stringify({ ...prev, ...patch, at: new Date().toISOString() })
    )
  } catch {
    /* ignore */
  }
}

export function rememberSoloFocusOpen(cardId: string, journeyId: JourneyId): void {
  writeSessionMemory({
    last_route: 'zone',
    last_solo_focus: { cardId, journeyId, at: new Date().toISOString() },
  })
}

export function clearSoloFocusMemory(): void {
  const prev = readSessionMemory()
  if (!prev) return
  writeSessionMemory({ ...prev, last_solo_focus: undefined })
}
