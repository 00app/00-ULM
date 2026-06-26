import type { JourneyId } from '@/lib/journeys'
import { safeGetItem, safeSetItem } from '@/lib/zone/safeProfileStorage'

const ZAI_LIKES_KEY = 'zz_zai_likes'

export type ZaiLikeRecord = {
  id: string
  title: string
  journey_key: JourneyId | string
  money: string
  carbon: string
  sourceUrl?: string
  offerUrl?: string
  ctaLabel?: string
}

export function readZaiLikes(): ZaiLikeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = safeGetItem(ZAI_LIKES_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (r): r is ZaiLikeRecord =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as ZaiLikeRecord).id === 'string' &&
        typeof (r as ZaiLikeRecord).title === 'string'
    )
  } catch {
    return []
  }
}

export function upsertZaiLike(record: ZaiLikeRecord): void {
  if (typeof window === 'undefined') return
  const prev = readZaiLikes()
  const byId = new Map(prev.map((r) => [r.id, r]))
  byId.set(record.id, record)
  try {
    safeSetItem(ZAI_LIKES_KEY, JSON.stringify([...byId.values()]))
  } catch {
    /* quota */
  }
}

export function removeZaiLike(id: string): void {
  if (typeof window === 'undefined') return
  const next = readZaiLikes().filter((r) => r.id !== id)
  try {
    safeSetItem(ZAI_LIKES_KEY, JSON.stringify(next))
  } catch {
    /* quota */
  }
}
