import { notFound } from 'next/navigation'
import { isValidZoneCardSlug } from '@/lib/actions/actionLibrary'
import ZonePage from '@/app/zone/page'

/**
 * Fallback for direct loads of a card URL (deep link, shared link, tab restore with no /zone
 * page already mounted to intercept from) — see app/zone/@modal for the intercepted route
 * that handles the soft-navigation case. Renders the exact same Zone page, just pre-opened
 * on this card, instead of duplicating the card UI here.
 */
export default async function ZoneCardFallbackPage({
  params,
}: {
  params: Promise<{ journeyKey: string }>
}) {
  const { journeyKey } = await params
  // Accepts a category slug (guest wall) or an action id (ranked wall) — a ranked wall can hold
  // several cards from one category, so cards are addressed by action.
  if (!isValidZoneCardSlug(journeyKey)) notFound()
  return <ZonePage initialExpandedCardId={`journey-${journeyKey}`} />
}
