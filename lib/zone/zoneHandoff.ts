import { bumpCategoryIntent } from '@/lib/zone/categoryIntent'
import { recordCardVisitHandoff } from '@/lib/zone/visitedCards'

export type ZoneExternalHandoff = {
  cardId: string
  url: string
  title?: string
  journeyKey?: string
}

/** Open external audit link in a new tab after marking visited (local + Neon). */
export function openZoneExternalHandoff(handoff: ZoneExternalHandoff): boolean {
  const url = handoff.url.trim()
  if (!url.startsWith('http')) return false
  bumpCategoryIntent(handoff.journeyKey, 'link')
  void recordCardVisitHandoff({
    cardId: handoff.cardId,
    url,
    title: handoff.title,
    journeyKey: handoff.journeyKey,
  })
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  } catch {
    return false
  }
}
