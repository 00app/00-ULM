import type { JourneyId } from '@/lib/journeys'
import { clampZoneBentoHeadline } from '@/lib/soloFocusCopy'

export type LikeCardSnapshot = {
  id: string
  journey_key: JourneyId
  title: string
  money: string
  carbon: string
  offerUrl?: string
  kind: 'journey' | 'tip' | 'rock'
}

const STORAGE_KEY = 'zz_like_card_snapshots_v1'

function readMap(): Record<string, LikeCardSnapshot> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, LikeCardSnapshot>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, LikeCardSnapshot>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

export function saveLikeCardSnapshot(snapshot: LikeCardSnapshot): void {
  const map = readMap()
  map[snapshot.id] = {
    ...snapshot,
    title: clampZoneBentoHeadline(snapshot.title),
  }
  writeMap(map)
}

export function removeLikeCardSnapshot(cardId: string): void {
  const map = readMap()
  if (!map[cardId]) return
  delete map[cardId]
  writeMap(map)
}

export function readLikeCardSnapshot(cardId: string): LikeCardSnapshot | null {
  return readMap()[cardId] ?? null
}

export function readAllLikeCardSnapshots(): Record<string, LikeCardSnapshot> {
  return readMap()
}
