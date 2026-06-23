import type { JourneyId } from '@/lib/journeys'
import { readAllDislikeCardSnapshots } from '@/lib/client/dislikeCardSnapshots'
import { readAllIndifferentCardSnapshots } from '@/lib/client/indifferentCardSnapshots'
import {
  buildDislikeScrapeAvoidHint,
  buildOfferPreferenceState,
} from '@/lib/zone/offerPreference'

export const OFFER_SIGNALS = ['like', 'dislike', 'indifferent', 'ask'] as const
export type OfferSignal = (typeof OFFER_SIGNALS)[number]

export type OfferSignalPayload = {
  card_id: string
  signal: OfferSignal
  journey_key?: string | null
  card_title?: string | null
  money_gbp?: number | null
}

const DISLIKED_STORAGE_KEY = 'zz_disliked_card_ids_v1'
const INDIFFERENT_IDS_KEY = 'zz_indifferent_card_ids_v1'

export const OFFER_PREFERENCE_CHANGED_EVENT = 'zz-offer-preference-changed'

export function readDislikedCardIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DISLIKED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120)
  } catch {
    return []
  }
}

export function readIndifferentCardIdsLocal(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(INDIFFERENT_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export function writeDislikedCardIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DISLIKED_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* quota */
  }
}

function writeIndifferentCardIdsLocal(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(INDIFFERENT_IDS_KEY, JSON.stringify(ids))
  } catch {
    /* quota */
  }
}

function notifyOfferPreferenceChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(OFFER_PREFERENCE_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

/** Client-side scrape hint from stored dislike / indifferent snapshots. */
export function buildClientOfferAvoidHint(journeyKey?: string | null): string {
  if (typeof window === 'undefined') return ''
  const prefs = buildOfferPreferenceState({
    dislikedCardIds: readDislikedCardIds(),
    indifferentCardIds: readIndifferentCardIdsLocal(),
    dislikeSnapshots: Object.values(readAllDislikeCardSnapshots()),
    indifferentSnapshots: Object.values(readAllIndifferentCardSnapshots()),
  })
  return buildDislikeScrapeAvoidHint(prefs, journeyKey)
}

/** Fire-and-forget — never blocks UI. */
export function recordOfferSignal(payload: OfferSignalPayload): void {
  if (typeof window === 'undefined') return
  const cardId = payload.card_id.trim()
  if (!cardId) return

  if (payload.signal === 'dislike') {
    writeDislikedCardIds(Array.from(new Set([...readDislikedCardIds(), cardId])))
  } else if (payload.signal === 'like') {
    writeDislikedCardIds(readDislikedCardIds().filter((id) => id !== cardId))
  } else if (payload.signal === 'indifferent') {
    writeIndifferentCardIdsLocal(Array.from(new Set([...readIndifferentCardIdsLocal(), cardId])))
  }

  notifyOfferPreferenceChanged()

  void fetch('/api/offer-signals', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_id: cardId,
      signal: payload.signal,
      journey_key: payload.journey_key ?? undefined,
      card_title: payload.card_title ?? undefined,
      money_gbp: payload.money_gbp ?? undefined,
    }),
  }).catch(() => {
    /* non-fatal */
  })
}

export function normalizeOfferJourneyKey(raw?: string | null): JourneyId | null {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^journey-/, '')
  return k.length > 0 ? (k as JourneyId) : null
}
