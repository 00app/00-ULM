/** Zone bento — visited / deep-dive handoff memory (client). */

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
  if (typeof window === 'undefined') return
  try {
    await fetch('/api/likes/track', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: args.cardId,
        url: args.url ?? undefined,
        title: args.title ?? 'Visited audit',
        journey_key: args.journeyKey,
        type: 'visited',
      }),
    })
  } catch {
    /* non-blocking */
  }
}
