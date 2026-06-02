import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/zone/buildZoneViewModel'
import { isKnownDeadOfferUrl, sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { journeyKeyFromTip } from '@/lib/zone/perCategoryCardCap'
import {
  normalizeOfferUrlKey,
  pickUnusedTrustedOfferUrl,
  trustedUrlForJourney,
} from '@/lib/zone/trustedJourneyUrls'
import { shieldOfferUrl } from '@/lib/zone/urlShield'

/** Resolved https offer used for BUY / source on a zone tip or journey card. */
export function resolveZoneCardOfferUrl(card: ZoneTipCard): string {
  const jid = journeyKeyFromTip(card)
  const raw =
    card.actions?.actionUrl?.trim() ||
    card.actions?.learnUrl?.trim() ||
    card.cta?.url?.trim() ||
    card.source?.trim() ||
    ''
  const sanitized = sanitizeZoneOfferUrl(raw, jid)
  if (isKnownDeadOfferUrl(sanitized)) return trustedUrlForJourney(jid)
  return shieldOfferUrl(sanitized, jid)
}

export function offerUrlKeyForCard(card: ZoneTipCard): string {
  return normalizeOfferUrlKey(resolveZoneCardOfferUrl(card))
}

export function isDuplicateOfferUrlForJourney(
  journeyKey: JourneyId,
  urlKey: string,
  seenByJourney: Map<JourneyId, Set<string>>
): boolean {
  if (!urlKey) return false
  return (seenByJourney.get(journeyKey) ?? new Set()).has(urlKey)
}

export function rememberOfferUrlForJourney(
  journeyKey: JourneyId,
  urlKey: string,
  seenByJourney: Map<JourneyId, Set<string>>
): void {
  if (!urlKey) return
  const set = seenByJourney.get(journeyKey) ?? new Set()
  set.add(urlKey)
  seenByJourney.set(journeyKey, set)
}

function patchZoneTipOfferUrls(card: ZoneTipCard, url: string): ZoneTipCard {
  return {
    ...card,
    source: url,
    actions: {
      actionType: card.actions?.actionType ?? 'learn',
      learnUrl: url,
      actionUrl: url,
    },
    cta: card.cta
      ? { ...card.cta, url }
      : { label: 'Get this Saving', url },
  }
}

/**
 * One distinct BUY URL per journey on the wall — remaps duplicates to alternates
 * (travel: railcards → gov.uk rail fares → Trainline cheap tickets).
 */
export function uniquifyZoneTipOfferUrl(
  tip: ZoneTipCard,
  seenByJourney: Map<JourneyId, Set<string>>
): ZoneTipCard {
  const jid = journeyKeyFromTip(tip)
  const used = seenByJourney.get(jid) ?? new Set<string>()
  let url = resolveZoneCardOfferUrl(tip)
  let key = normalizeOfferUrlKey(url)

  if (key && used.has(key)) {
    url = pickUnusedTrustedOfferUrl(jid, used)
    key = normalizeOfferUrlKey(url)
    seenByJourney.set(jid, used)
    return patchZoneTipOfferUrls(tip, url)
  }

  if (key) used.add(key)
  seenByJourney.set(jid, used)
  if (url !== resolveZoneCardOfferUrl(tip)) return patchZoneTipOfferUrls(tip, url)
  return tip
}
