import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import type { JourneyId } from '@/lib/journeys'
import { bumpCategoryIntent } from '@/lib/zone/categoryIntent'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { recordCardVisitHandoff } from '@/lib/zone/visitedCards'
import { wrapWithAwinAffiliateLink } from '@/lib/monetization/awinAffiliateLink'

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
  trackFunnelEvent('cta_click', {
    card_id: handoff.cardId,
    journey_id: handoff.journeyKey,
    target_url: url,
    link_kind: 'external',
  })
  try {
    window.open(
      wrapWithAwinAffiliateLink(url, handoff.cardId, handoff.journeyKey),
      '_blank',
      'noopener,noreferrer'
    )
    return true
  } catch {
    return false
  }
}
