/**
 * Turns ranked library actions into the wall's existing card shape.
 *
 * The pivot this completes: the wall used to build one card per category and then reach for
 * content to fill it, which is why a renter got a SOLAR card and a non-driver got a TRAVEL card.
 * Now the twelve cards ARE the twelve best actions for this person, and the category is only a
 * label on them.
 *
 * One structural consequence worth understanding: the old wall could assume one card per
 * `journey_key`, because that's literally how it was built. A ranked wall can legitimately
 * return three MONEY cards, so card ids are keyed on the action rather than the category and
 * the card route resolves both (see `isValidZoneCardSlug`).
 */

import type { ZoneAction } from '@/lib/actions/actionTypes'
import type { ZoneJourneyCard } from '@/lib/zone/buildZoneViewModel'
import { formatCarbon, formatZoneCardMoney } from '@/lib/format'

/** Card id for a library-backed action. Mirrors the legacy `journey-<key>` convention. */
export function actionCardId(actionId: string): string {
  return `journey-${actionId}`
}

/**
 * The wall shows headlines in caps and clamps them, so keep the action line short and let the
 * detail line carry the nuance. No locality interpolation anywhere — the ranker never invents a
 * local claim it can't source.
 */
function actionTitle(a: ZoneAction): string {
  return a.action
}

/** Maps the library verb onto the renderer's existing action-type union. */
function actionTypeFor(a: ZoneAction): 'learn' | 'switch' | 'buy' | 'apply' {
  switch (a.verb) {
    case 'CLAIM':
      return 'apply'
    case 'SWITCH':
      return 'switch'
    case 'BUY':
      return 'buy'
    default:
      return 'learn'
  }
}

/**
 * Attribution shown on the card. Derived from the destination host so the badge can never
 * disagree with where the button actually goes — the exact failure found on the live wall,
 * where a card badged "DEFRA AVIATION FACTORS" opened Eurostar.
 */
export function attributionForUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    return host.toUpperCase()
  } catch {
    return 'GOV.UK'
  }
}

export function actionToJourneyCard(a: ZoneAction): ZoneJourneyCard {
  const attribution = attributionForUrl(a.url)
  return {
    id: actionCardId(a.id),
    variant: 'card-standard',
    title: actionTitle(a),
    journey_key: a.bucket,
    category: a.bucket,
    data: {
      carbon: a.valueKg > 0 ? formatCarbon(a.valueKg) : '—',
      money: a.valueGbp > 0 ? formatZoneCardMoney(a.valueGbp) : '—',
    },
    carbonKg: a.valueKg,
    moneyGbp: a.valueGbp,
    source: a.url,
    sourceLabel: `source. ${attribution.toLowerCase()}`,
    source_name: attribution,
    source_date: a.verifiedOn,
    // Every library action carries its own live, verified URL — never the "no live retailer
    // link" fallback footer that partner_link's absence would otherwise trigger.
    partner_link: a.url,
    explanation: [a.detail],
    actions: {
      actionType: actionTypeFor(a),
      learnUrl: a.url,
      actionUrl: a.url,
    },
    // CLAIM actions are money the user is already entitled to, so they get the priority
    // treatment the wall reserves for grant-eligible tiles.
    isPriorityAlert: a.verb === 'CLAIM',
    claimOfferUrl: a.verb === 'CLAIM' ? a.url : undefined,
    architectSuppliedBy: attribution,
    architectActionLine: a.detail,
    streamPending: false,
  }
}

export function actionsToJourneyCards(actions: ZoneAction[]): ZoneJourneyCard[] {
  return actions.map(actionToJourneyCard)
}
