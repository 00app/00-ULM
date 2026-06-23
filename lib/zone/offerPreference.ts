/**
 * Offer feedback → bento wall suppression + journey sort weights + scrape avoid hints.
 * Dislike = hard suppress + strong negative weight. Indifferent = soft deprioritize only.
 */

import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { normalizeCardHeadlineKey } from '@/lib/soloFocusCopy'

export const OFFER_WEIGHT_DISLIKE = -12
export const OFFER_WEIGHT_INDIFFERENT = -3

export type OfferPreferenceCard = {
  id: string
  journey_key?: JourneyId | string | null
  title?: string | null
}

export type OfferPreferenceState = {
  dislikedCardIds: Set<string>
  indifferentCardIds: Set<string>
  /** Normalized topic tokens from disliked card titles (e-bike, flight, etc.). */
  suppressedTopicKeys: Set<string>
  /** Normalized headlines from disliked cards — suppress same headline on wall. */
  dislikedHeadlineKeys: Set<string>
  journeyDislikeCount: Partial<Record<JourneyId, number>>
  journeyIndifferentCount: Partial<Record<JourneyId, number>>
}

const TOPIC_STOP = new Set([
  'the',
  'and',
  'for',
  'your',
  'with',
  'from',
  'this',
  'that',
  'about',
  'into',
  'without',
  'local',
  'short',
  'shine',
  'schemes',
  'scheme',
  'offer',
  'offers',
  'card',
  'year',
])

/** Extract stable topic tokens for cross-card suppression. */
export function extractOfferTopicKeys(title?: string | null, cardId?: string | null): string[] {
  const keys = new Set<string>()
  const id = String(cardId ?? '').toLowerCase()
  if (id.includes('e-bike') || id.includes('ebike') || id.includes('bike')) keys.add('e-bike')
  if (id.includes('flight') || id.includes('rail')) keys.add('flight')
  if (id.includes('solar')) keys.add('solar')
  if (id.includes('heat-pump') || id.includes('heatpump')) keys.add('heat-pump')

  const raw = String(title ?? '').toLowerCase()
  for (const token of raw.split(/[^a-z0-9]+/)) {
    const t = token.trim()
    if (t.length < 3 || TOPIC_STOP.has(t)) continue
    keys.add(t)
    if (t.includes('ebike')) keys.add('e-bike')
    if (t.includes('bike') && !t.includes('motor')) keys.add('e-bike')
    if (t.includes('flight')) keys.add('flight')
    if (t.includes('solar')) keys.add('solar')
    if (t.includes('heat') && t.includes('pump')) keys.add('heat-pump')
  }
  return [...keys]
}

function normalizeJourneyKey(raw?: string | null): JourneyId | null {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^journey-/, '')
    .replace(/^tip-/, '')
    .replace(/^rock-/, '')
  return (JOURNEY_ORDER as readonly string[]).includes(k) ? (k as JourneyId) : null
}

export function journeyKeyFromCardId(cardId: string): JourneyId | null {
  const id = cardId.trim().toLowerCase()
  if (id.startsWith('journey-')) return normalizeJourneyKey(id.slice('journey-'.length))
  if (id.startsWith('tip-')) return normalizeJourneyKey(id.slice('tip-'.length))
  if (id.startsWith('rock-')) {
    const rest = id.slice('rock-'.length)
    const jid = rest.split('-')[0]
    return normalizeJourneyKey(jid)
  }
  return null
}

export function buildOfferPreferenceState(args: {
  dislikedCardIds?: readonly string[]
  indifferentCardIds?: readonly string[]
  dislikeSnapshots?: readonly OfferPreferenceCard[]
  indifferentSnapshots?: readonly OfferPreferenceCard[]
}): OfferPreferenceState {
  const dislikedCardIds = new Set(args.dislikedCardIds ?? [])
  const indifferentCardIds = new Set(args.indifferentCardIds ?? [])
  const suppressedTopicKeys = new Set<string>()
  const dislikedHeadlineKeys = new Set<string>()
  const journeyDislikeCount: Partial<Record<JourneyId, number>> = {}
  const journeyIndifferentCount: Partial<Record<JourneyId, number>> = {}

  const bumpJourney = (
    map: Partial<Record<JourneyId, number>>,
    jid: JourneyId | null
  ) => {
    if (!jid) return
    map[jid] = (map[jid] ?? 0) + 1
  }

  for (const snap of args.dislikeSnapshots ?? []) {
    if (snap.id) dislikedCardIds.add(snap.id)
    for (const key of extractOfferTopicKeys(snap.title, snap.id)) suppressedTopicKeys.add(key)
    const headlineKey = normalizeCardHeadlineKey(snap.title ?? '')
    if (headlineKey) dislikedHeadlineKeys.add(headlineKey)
    bumpJourney(journeyDislikeCount, normalizeJourneyKey(snap.journey_key) ?? journeyKeyFromCardId(snap.id))
  }

  for (const id of dislikedCardIds) {
    bumpJourney(journeyDislikeCount, journeyKeyFromCardId(id))
  }

  for (const snap of args.indifferentSnapshots ?? []) {
    if (snap.id) indifferentCardIds.add(snap.id)
    bumpJourney(journeyIndifferentCount, normalizeJourneyKey(snap.journey_key) ?? journeyKeyFromCardId(snap.id))
  }

  for (const id of indifferentCardIds) {
    bumpJourney(journeyIndifferentCount, journeyKeyFromCardId(id))
  }

  return {
    dislikedCardIds,
    indifferentCardIds,
    suppressedTopicKeys,
    dislikedHeadlineKeys,
    journeyDislikeCount,
    journeyIndifferentCount,
  }
}

export function journeyOfferPreferenceWeight(
  jid: JourneyId,
  prefs: OfferPreferenceState
): number {
  const dislikes = prefs.journeyDislikeCount[jid] ?? 0
  const indifferent = prefs.journeyIndifferentCount[jid] ?? 0
  return dislikes * OFFER_WEIGHT_DISLIKE + indifferent * OFFER_WEIGHT_INDIFFERENT
}

export function buildOfferPreferenceWeights(
  prefs: OfferPreferenceState
): Partial<Record<JourneyId, number>> {
  const out: Partial<Record<JourneyId, number>> = {}
  for (const jid of JOURNEY_ORDER) {
    const w = journeyOfferPreferenceWeight(jid, prefs)
    if (w !== 0) out[jid] = w
  }
  return out
}

function cardSharesSuppressedTopic(card: OfferPreferenceCard, prefs: OfferPreferenceState): boolean {
  if (prefs.suppressedTopicKeys.size === 0) return false
  const keys = extractOfferTopicKeys(card.title, card.id)
  return keys.some((k) => prefs.suppressedTopicKeys.has(k))
}

/** Hard suppress — disliked id or matching disliked topic family. */
export function isWallCardSuppressed(
  card: OfferPreferenceCard,
  prefs: OfferPreferenceState
): boolean {
  const id = card.id.trim()
  if (!id) return false
  if (prefs.dislikedCardIds.has(id)) return true
  if (cardSharesSuppressedTopic(card, prefs)) return true
  const headlineKey = normalizeCardHeadlineKey(card.title ?? '')
  if (headlineKey && prefs.dislikedHeadlineKeys.has(headlineKey)) return true
  return false
}

/** Soft score for tip sort within a journey (higher = show first). */
export function wallCardSortBias(card: OfferPreferenceCard, prefs: OfferPreferenceState): number {
  const id = card.id.trim()
  if (prefs.dislikedCardIds.has(id)) return -1000
  if (cardSharesSuppressedTopic(card, prefs)) return -500
  if (prefs.indifferentCardIds.has(id)) return -40
  const jid = normalizeJourneyKey(card.journey_key) ?? journeyKeyFromCardId(id)
  if (jid) return journeyOfferPreferenceWeight(jid, prefs)
  return 0
}

export function buildDislikeScrapeAvoidHint(
  prefs: OfferPreferenceState,
  journeyKey?: string | null
): string {
  const lines: string[] = []
  const jid = normalizeJourneyKey(journeyKey)

  if (prefs.suppressedTopicKeys.size > 0) {
    const topics = [...prefs.suppressedTopicKeys].slice(0, 12).join(', ')
    lines.push(`User rejected these offer topics — do NOT surface again: ${topics}.`)
  }

  if (jid && (prefs.journeyDislikeCount[jid] ?? 0) > 0) {
    lines.push(
      `User disliked prior ${jid} offers — pivot to a different verified UK mechanism in this category.`
    )
  }

  if (lines.length === 0) return ''
  return lines.join('\n')
}
