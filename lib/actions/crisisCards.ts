/**
 * Crisis routes as wall cards.
 *
 * Reuses the existing card shape so the renderer needs no changes, but the money slot carries
 * `relief` ("60 days — creditors must stop") instead of a £ figure. Pounds-per-year is the wrong
 * unit when the horizon is this week, and "£0" would be worse than nothing.
 */

import type { CrisisRoute } from '@/lib/actions/crisisTypes'
import type { ZoneJourneyCard } from '@/lib/zone/buildZoneViewModel'

export function crisisCardId(routeId: string): string {
  return `journey-crisis-${routeId}`
}

export function crisisRouteToCard(r: CrisisRoute): ZoneJourneyCard {
  const contact = r.phone ? `Call ${r.phone}${r.hours ? ` · ${r.hours}` : ''}` : 'Opens the official page'
  return {
    id: crisisCardId(r.id),
    variant: 'card-standard',
    title: r.action,
    // Everything crisis lands in the money lane; the bucket is only used for grid diversity and
    // these are pinned to the top in fixed order anyway.
    journey_key: 'money',
    category: 'money',
    data: {
      // `relief` replaces the £ figure. This is the deliberate unit change — what it does and
      // how fast, not what it saves in a year.
      money: r.relief,
      carbon: '—',
    },
    moneyGbp: 0,
    carbonKg: 0,
    source: r.url,
    sourceLabel: `source. ${hostOf(r.url)}`,
    source_name: hostOf(r.url).toUpperCase(),
    source_date: r.verifiedOn,
    // The most valuable line in the whole feature: the words to say when someone picks up.
    explanation: [r.detail, `What to say: ${r.askFor}`, contact],
    actions: {
      actionType: 'apply',
      learnUrl: r.url,
      actionUrl: r.url,
    },
    claimOfferUrl: r.url,
    isPriorityAlert: true,
    architectSuppliedBy: hostOf(r.url).toUpperCase(),
    architectActionLine: r.askFor,
    streamPending: false,
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return 'gov.uk'
  }
}

export function crisisRoutesToCards(routes: CrisisRoute[]): ZoneJourneyCard[] {
  return routes.map(crisisRouteToCard)
}
