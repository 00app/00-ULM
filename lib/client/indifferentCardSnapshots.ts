import type { JourneyId } from '@/lib/journeys'

export type IndifferentCardSnapshot = {
  id: string
  journey_key: JourneyId
  title: string
}

const STORAGE_KEY = 'zz_indifferent_card_snapshots_v1'
const IDS_KEY = 'zz_indifferent_card_ids_v1'

function readMap(): Record<string, IndifferentCardSnapshot> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, IndifferentCardSnapshot>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, IndifferentCardSnapshot>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    localStorage.setItem(IDS_KEY, JSON.stringify(Object.keys(map)))
  } catch {
    /* quota */
  }
}

export function saveIndifferentCardSnapshot(snapshot: IndifferentCardSnapshot): void {
  const map = readMap()
  map[snapshot.id] = snapshot
  writeMap(map)
}

export function readIndifferentCardIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(IDS_KEY)
    if (!raw) return Object.keys(readMap())
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return Object.keys(readMap())
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return Object.keys(readMap())
  }
}

export function writeIndifferentCardIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify(ids))
  } catch {
    /* quota */
  }
}

export function readAllIndifferentCardSnapshots(): Record<string, IndifferentCardSnapshot> {
  return readMap()
}
