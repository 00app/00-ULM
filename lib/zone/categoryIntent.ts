/**
 * Client-side category intent weights — link clicks, likes, and chat pins boost hero sort.
 */

import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'

export const CATEGORY_INTENT_STORAGE_KEY = 'zz_category_intent'
export const CATEGORY_INTENT_CHANGED_EVENT = 'zz-category-intent-changed'

const INTENT_LINK = 3
const INTENT_LIKE = 2
const INTENT_CHAT = 2
const INTENT_VISITED = 4

export type CategoryIntentSignal = 'link' | 'like' | 'chat' | 'visited'

function normalizeJourneyKey(raw?: string | null): JourneyId | null {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^journey-/, '')
  return (JOURNEY_ORDER as readonly string[]).includes(k) ? (k as JourneyId) : null
}

function readRaw(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(CATEGORY_INTENT_STORAGE_KEY) ?? '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function readCategoryIntentWeights(): Partial<Record<JourneyId, number>> {
  const raw = readRaw()
  const out: Partial<Record<JourneyId, number>> = {}
  for (const jid of JOURNEY_ORDER) {
    const w = raw[jid]
    if (w != null && w > 0) out[jid] = w
  }
  return out
}

export function bumpCategoryIntent(
  journeyKey: string | null | undefined,
  signal: CategoryIntentSignal
): void {
  const jid = normalizeJourneyKey(journeyKey)
  if (!jid || typeof window === 'undefined') return
  const delta =
    signal === 'link'
      ? INTENT_LINK
      : signal === 'like'
        ? INTENT_LIKE
        : signal === 'visited'
          ? INTENT_VISITED
          : INTENT_CHAT
  const raw = readRaw()
  raw[jid] = (raw[jid] ?? 0) + delta
  try {
    localStorage.setItem(CATEGORY_INTENT_STORAGE_KEY, JSON.stringify(raw))
    window.dispatchEvent(
      new CustomEvent(CATEGORY_INTENT_CHANGED_EVENT, { detail: { journeyKey: jid, signal, weight: raw[jid] } })
    )
  } catch {
    /* quota */
  }
}
