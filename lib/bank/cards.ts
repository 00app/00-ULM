/**
 * Bank-derived recommendation cards and their CTA state machine.
 *
 *   not connected → "Connect to see your saving"          (handled on the card in recCard.ts)
 *   connected     → "Switch from [supplier], save £X/yr"  (opens the partner link)
 *   link opened   → "I've switched"                       (user confirms)
 *   confirmed     → "Switched"                            (counts towards the tracker)
 *
 * Every figure keeps its source: sample-derived savings carry the "Sample data" badge.
 */

import type { JourneyId } from '@/lib/journeys'
import type { BankOpportunity, RecurringCategory } from '@/lib/bank/analysis'
import { opportunityKey, type SwitchRecords } from '@/lib/bank/switchTracker'
import {
  resolveRecCard,
  type RecCardCta,
  type RecCardModel,
  type SavingSource,
} from '@/lib/zone/recCard'

const CATEGORY_LABEL: Record<RecurringCategory, string> = {
  energy: 'ENERGY',
  broadband: 'BROADBAND',
  mobile: 'MOBILE',
  insurance: 'INSURANCE',
  subscription: 'SUBSCRIPTIONS',
  other: 'BILLS',
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function monthName(iso: string): string | null {
  const m = Number.parseInt(iso.slice(5, 7), 10)
  return m >= 1 && m <= 12 ? MONTHS[m - 1] : null
}

/** "You pay £148/mo to British Gas, up 25% since April." — real numbers only. */
export function bankWhyYou(o: BankOpportunity): string {
  const monthly = Math.round(o.monthlyGbp)
  const base = `You pay £${monthly}/mo to ${o.supplierName}`
  if (o.priceRise) {
    const month = monthName(o.priceRise.since)
    return `${base}, up ${Math.round(o.priceRise.pct)}%${month ? ` since ${month}` : ''}.`
  }
  return `${base}.`
}

/**
 * Partner prefill parameters. Only add a host here once the partner has DOCUMENTED the parameter;
 * guessing a query string would silently break the link. Awin wrapping (when a merchant id is
 * approved) is applied at click time by wrapWithAwinAffiliateLink, not here.
 */
const PARTNER_PREFILL: Record<string, (ctx: { postcode?: string | null }) => Record<string, string>> = {}

export function switchUrlFor(offerUrl: string | null | undefined, ctx: { postcode?: string | null }): string | null {
  const raw = offerUrl?.trim()
  if (!raw || !raw.startsWith('https://')) return null
  try {
    const u = new URL(raw)
    const prefill = PARTNER_PREFILL[u.hostname.replace(/^www\./, '')]
    if (prefill) for (const [k, v] of Object.entries(prefill(ctx))) if (v) u.searchParams.set(k, v)
    return u.toString()
  } catch {
    return null
  }
}

function savingSourceFor(o: BankOpportunity): SavingSource {
  return o.source === 'sample'
    ? { kind: 'sample', name: 'Sample bank data' }
    : { kind: 'verified', name: `Your bank data and ${o.offer?.sourceName ?? 'verified offer data'}` }
}

export function bankCardId(o: Pick<BankOpportunity, 'category' | 'supplierName'>): string {
  return `bank-${o.category}-${o.supplierName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/** CTA for the current switch state of one opportunity. */
export function switchCtas(
  o: BankOpportunity,
  records: SwitchRecords,
  ctx: { postcode?: string | null }
): { primary: RecCardCta; secondary?: RecCardCta } {
  const key = opportunityKey(o.category, o.supplierName)
  const rec = records[key]
  if (rec?.state === 'switched') return { primary: { kind: 'done', label: 'Switched' } }
  if (rec?.state === 'clicked') {
    return {
      primary: { kind: 'confirm_switch', label: "I've switched" },
      secondary: { kind: 'reset_switch', label: 'Not yet' },
    }
  }
  const href = switchUrlFor(o.offer?.url, ctx)
  return {
    primary: {
      kind: 'switch',
      label: `Switch from ${o.supplierName}, save £${Math.round(o.savingGbpPerYear ?? 0)}/yr`,
      href,
    },
  }
}

/**
 * One card per switchable bill with an honest saving. `openJourneyId` is the existing Utilities
 * journey card, which the card body opens for the full detail. Returns null when there is no
 * honest saving, no offer link, or no journey to open (no number, no card).
 */
export function opportunityToRecCard(
  o: BankOpportunity,
  opts: { openJourneyId: string | null; records: SwitchRecords; postcode?: string | null }
): RecCardModel | null {
  if (o.savingGbpPerYear == null || o.savingGbpPerYear <= 0 || !opts.openJourneyId) return null
  if (!switchUrlFor(o.offer?.url, { postcode: opts.postcode })) return null
  const ctas = switchCtas(o, opts.records, { postcode: opts.postcode })
  const card = resolveRecCard({
    id: bankCardId(o),
    size: 'large',
    category: o.journey as JourneyId,
    label: CATEGORY_LABEL[o.category],
    actionWording: `Switch from ${o.supplierName}`,
    savingGbpPerYear: o.savingGbpPerYear,
    savingSource: savingSourceFor(o),
    whyYou: bankWhyYou(o),
    primaryCta: ctas.primary,
    secondaryCta: ctas.secondary,
    dependsOnBank: true,
    openRef: { type: 'journey', id: opts.openJourneyId },
  })
  return card
}
