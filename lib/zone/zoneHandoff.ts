import type { JourneyId } from '@/lib/journeys'
import { bumpCategoryIntent } from '@/lib/zone/categoryIntent'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { recordCardVisitHandoff } from '@/lib/zone/visitedCards'

export type ZoneExternalHandoff = {
  cardId: string
  url: string
  title?: string
  journeyKey?: string
}

/** Open external audit link in a new tab after marking visited (local + Neon). */
export function openZoneExternalHandoff(handoff: ZoneExternalHandoff): boolean {
  const raw = handoff.url.trim()
  if (!raw.startsWith('http')) return false
  const url =
    handoff.journeyKey?.trim()
      ? sanitizeZoneOfferUrl(raw, handoff.journeyKey.trim() as JourneyId)
      : raw
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
