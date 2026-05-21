/** Zone bento — visited / deep-dive handoff memory (client). */

import { bumpCategoryIntent } from '@/lib/zone/categoryIntent'

export const VISITED_CARDS_KEY = 'visited_cards'
export const DEEP_DIVE_IN_PROGRESS_KEY = 'zz_deep_dive_in_progress'

export function readVisitedCardIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(VISITED_CARDS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

/** Merge server-side visit breadcrumbs (guest zz_sid) into localStorage. */
export function mergeVisitedFromServer(cardIds: string[], journeyKeys?: string[]): void {
  if (typeof window === 'undefined') return
  const set = readVisitedCardIds()
  for (const id of cardIds) {
    if (id.trim()) set.add(id.trim())
  }
  try {
    localStorage.setItem(VISITED_CARDS_KEY, JSON.stringify([...set]))
    window.dispatchEvent(new CustomEvent('zz-visited-cards-changed'))
  } catch {
    /* quota */
  }
  void journeyKeys
}

export function markCardVisited(cardId: string): void {
  if (typeof window === 'undefined' || !cardId.trim()) return
  const set = readVisitedCardIds()
  set.add(cardId.trim())
  try {
    localStorage.setItem(VISITED_CARDS_KEY, JSON.stringify([...set]))
    window.dispatchEvent(new CustomEvent('zz-visited-cards-changed'))
  } catch {
    /* quota */
  }
}

export function isCardVisited(cardId: string): boolean {
  return readVisitedCardIds().has(cardId.trim())
}

/** Visited (pink) cards: close must not spawn injections, loop takeovers, or tips-refresh. */
export function shouldSkipInjectionOnCardClose(cardId: string | null | undefined): boolean {
  const id = cardId?.trim()
  if (!id) return false
  return isCardVisited(id)
}

export function setDeepDiveInProgress(cardId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!cardId?.trim()) {
      sessionStorage.removeItem(DEEP_DIVE_IN_PROGRESS_KEY)
    } else {
      sessionStorage.setItem(DEEP_DIVE_IN_PROGRESS_KEY, cardId.trim())
    }
    window.dispatchEvent(new CustomEvent('zz-deep-dive-progress-changed'))
  } catch {
    /* ignore */
  }
}

export function readDeepDiveInProgressCardId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const id = sessionStorage.getItem(DEEP_DIVE_IN_PROGRESS_KEY)
    return id?.trim() || null
  } catch {
    return null
  }
}

/** Persist visit server-side (likes row) + local breadcrumb. */
export async function recordCardVisitHandoff(args: {
  cardId: string
  url?: string | null
  title?: string
  journeyKey?: string
}): Promise<void> {
  markCardVisited(args.cardId)
  setDeepDiveInProgress(args.cardId)
  if (args.journeyKey?.trim()) {
    bumpCategoryIntent(args.journeyKey, 'visited')
  }
  if (typeof window === 'undefined') return
  try {
    await fetch('/api/zone/visit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: args.cardId,
        url: args.url ?? undefined,
        journey_key: args.journeyKey,
      }),
    })
  } catch {
    /* non-blocking */
  }
}
