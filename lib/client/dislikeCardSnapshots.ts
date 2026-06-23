import type { JourneyId } from '@/lib/journeys'
import { clampZoneBentoHeadline } from '@/lib/soloFocusCopy'

export type DislikeCardSnapshot = {
  id: string
  journey_key: JourneyId
  title: string
}

const STORAGE_KEY = 'zz_dislike_card_snapshots_v1'

function readMap(): Record<string, DislikeCardSnapshot> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, DislikeCardSnapshot>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, DislikeCardSnapshot>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

export function saveDislikeCardSnapshot(snapshot: DislikeCardSnapshot): void {
  const map = readMap()
  map[snapshot.id] = {
    ...snapshot,
    title: clampZoneBentoHeadline(snapshot.title),
  }
  writeMap(map)
}

export function removeDislikeCardSnapshot(cardId: string): void {
  const map = readMap()
  if (!map[cardId]) return
  delete map[cardId]
  writeMap(map)
}

export function readAllDislikeCardSnapshots(): Record<string, DislikeCardSnapshot> {
  return readMap()
}
