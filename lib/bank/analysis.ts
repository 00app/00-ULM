/**
 * Bank analysis pipeline — real logic that runs on whatever a BankDataProvider returns.
 *   1. detect recurring payments and the supplier per category
 *   2. monthly amount and price-rise detection
 *   3. saving vs the best available offer from verified offer data
 *
 * Mechanical truth: a saving is only ever computed from two real numbers (the user's own
 * annualised spend and an offer's annual price), or taken as-is from a verified typical-saving
 * figure and labelled `typical`. If neither exists the saving is null. Figures derived from the
 * sample provider carry source "sample".
 */

import type { JourneyId } from '@/lib/journeys'
import type { BankFigureSource, BankTransaction } from '@/lib/bank/types'

export type RecurringCategory = 'energy' | 'broadband' | 'mobile' | 'insurance' | 'subscription' | 'other'

export type PriceRise = {
  fromPence: number
  toPence: number
  /** Percentage increase, one decimal place. */
  pct: number
  /** Date of the first payment at the new level. */
  since: string
}

export type RecurringPayment = {
  merchantKey: string
  displayName: string
  category: RecurringCategory
  occurrences: number
  firstDate: string
  lastDate: string
  /** Current monthly level in pence (median of the last three payments). */
  monthlyAmountPence: number
  priceRise: PriceRise | null
}

export type BestOffer = {
  category: RecurringCategory
  providerName: string
  url: string | null
  /** What the offer costs per year for the same usage, when known. */
  annualPriceGbp?: number | null
  /** A verified typical saving (from research), when no annual price is known. */
  verifiedSavingGbp?: number | null
  sourceName: string
}
export type OfferBook = Partial<Record<RecurringCategory, BestOffer>>

export type BankOpportunity = {
  category: RecurringCategory
  journey: JourneyId
  supplierName: string
  monthlyGbp: number
  annualGbp: number
  priceRise: PriceRise | null
  offer: BestOffer | null
  /** null when no honest saving can be computed. */
  savingGbpPerYear: number | null
  savingBasis: 'your_spend' | 'typical' | null
  source: BankFigureSource
}

export type BankAnalysis = {
  source: BankFigureSource
  recurring: RecurringPayment[]
  monthlyRecurringTotalPence: number
  opportunities: BankOpportunity[]
}

// ── classification ────────────────────────────────────────────────────────────────────────────

type Known = { match: RegExp; name: string; category: RecurringCategory }
const KNOWN: Known[] = [
  { match: /BRITISH GAS/, name: 'British Gas', category: 'energy' },
  { match: /OCTOPUS/, name: 'Octopus Energy', category: 'energy' },
  { match: /\bEDF\b/, name: 'EDF', category: 'energy' },
  { match: /E ?ON/, name: 'E.ON Next', category: 'energy' },
  { match: /\bOVO\b/, name: 'OVO Energy', category: 'energy' },
  { match: /SCOTTISH POWER/, name: 'Scottish Power', category: 'energy' },
  { match: /SHELL ENERGY/, name: 'Shell Energy', category: 'energy' },
  { match: /UTILITY WAREHOUSE/, name: 'Utility Warehouse', category: 'energy' },
  { match: /\bSKY (BROADBAND|BB)|^SKY\b/, name: 'Sky', category: 'broadband' },
  { match: /\bBT (BROADBAND|GROUP)|^BT\b/, name: 'BT', category: 'broadband' },
  { match: /VIRGIN MEDIA/, name: 'Virgin Media', category: 'broadband' },
  { match: /TALKTALK/, name: 'TalkTalk', category: 'broadband' },
  { match: /PLUSNET/, name: 'Plusnet', category: 'broadband' },
  { match: /^EE\b/, name: 'EE', category: 'mobile' },
  { match: /\bO2\b/, name: 'O2', category: 'mobile' },
  { match: /\bTHREE\b/, name: 'Three', category: 'mobile' },
  { match: /VODAFONE/, name: 'Vodafone', category: 'mobile' },
  { match: /GIFFGAFF/, name: 'giffgaff', category: 'mobile' },
  { match: /ADMIRAL/, name: 'Admiral', category: 'insurance' },
  { match: /AVIVA/, name: 'Aviva', category: 'insurance' },
  { match: /DIRECT LINE/, name: 'Direct Line', category: 'insurance' },
  { match: /\bAXA\b/, name: 'AXA', category: 'insurance' },
  { match: /HASTINGS/, name: 'Hastings', category: 'insurance' },
  { match: /NETFLIX/, name: 'Netflix', category: 'subscription' },
  { match: /SPOTIFY/, name: 'Spotify', category: 'subscription' },
  { match: /AMAZON PRIME/, name: 'Amazon Prime', category: 'subscription' },
  { match: /DISNEY/, name: 'Disney+', category: 'subscription' },
  { match: /PUREGYM|THE GYM|GYM GROUP/, name: 'Gym', category: 'subscription' },
]

const STOP = new Set(['DD', 'REF', 'LTD', 'LIMITED', 'PLC', 'PAYMENT', 'CARD', 'GBP', 'UK', 'THE', 'DIRECT', 'DEBIT', 'COM'])

export function merchantKey(description: string): string {
  const tokens = description
    .toUpperCase()
    .replace(/[^A-Z& ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t))
  return tokens.slice(0, 2).join(' ')
}

function toTitle(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function classify(description: string, key: string): { name: string; category: RecurringCategory } {
  const up = description.toUpperCase()
  for (const k of KNOWN) if (k.match.test(up) || k.match.test(key)) return { name: k.name, category: k.category }
  return { name: toTitle(key), category: 'other' }
}

const CATEGORY_JOURNEY: Record<RecurringCategory, JourneyId> = {
  energy: 'utilities',
  broadband: 'utilities',
  mobile: 'utilities',
  insurance: 'money',
  subscription: 'money',
  other: 'money',
}

// ── recurring detection ───────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const MIN_OCCURRENCES = 3
const MONTHLY_MIN_DAYS = 24
const MONTHLY_MAX_DAYS = 38
/** Share of gaps that must look monthly. */
const MIN_MONTHLY_GAP_SHARE = 0.8
/** Every payment must be within this fraction of the series median (a price rise is allowed; groceries are not). */
const MAX_AMOUNT_SPREAD = 0.4
const PRICE_RISE_MIN_PCT = 5
const PRICE_RISE_MIN_PENCE = 100
/** After a rise, later payments must stay within this fraction of the new level for it to count as a rise. */
const RISE_HOLD_TOLERANCE = 0.03

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)
}

export function detectPriceRise(series: { date: string; pence: number }[]): PriceRise | null {
  if (series.length < MIN_OCCURRENCES) return null
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].pence
    const cur = series[i].pence
    const diff = cur - prev
    if (diff < PRICE_RISE_MIN_PENCE || (diff / prev) * 100 < PRICE_RISE_MIN_PCT) continue
    // The new level must hold for every later payment (a one-off spike that drops back is not a rise).
    const rest = series.slice(i)
    const holds = rest.every((p) => Math.abs(p.pence - cur) / cur <= RISE_HOLD_TOLERANCE)
    if (!holds) continue
    return { fromPence: prev, toPence: cur, pct: Math.round((diff / prev) * 1000) / 10, since: series[i].date }
  }
  return null
}

export function detectRecurring(transactions: readonly BankTransaction[]): RecurringPayment[] {
  const groups = new Map<string, { description: string; rows: { date: string; pence: number }[] }>()
  for (const t of transactions) {
    if (t.amountPence >= 0) continue
    const key = merchantKey(t.description)
    if (!key) continue
    const g = groups.get(key) ?? { description: t.description, rows: [] }
    g.rows.push({ date: t.date, pence: -t.amountPence })
    groups.set(key, g)
  }

  const out: RecurringPayment[] = []
  for (const [key, g] of groups) {
    const rows = [...g.rows].sort((a, b) => a.date.localeCompare(b.date))
    if (rows.length < MIN_OCCURRENCES) continue

    const gaps = rows.slice(1).map((r, i) => dayNumber(r.date) - dayNumber(rows[i].date))
    const monthlyGaps = gaps.filter((d) => d >= MONTHLY_MIN_DAYS && d <= MONTHLY_MAX_DAYS).length
    if (monthlyGaps / gaps.length < MIN_MONTHLY_GAP_SHARE) continue

    const med = median(rows.map((r) => r.pence))
    if (rows.some((r) => Math.abs(r.pence - med) / med > MAX_AMOUNT_SPREAD)) continue

    const { name, category } = classify(g.description, key)
    out.push({
      merchantKey: key,
      displayName: name,
      category,
      occurrences: rows.length,
      firstDate: rows[0].date,
      lastDate: rows[rows.length - 1].date,
      monthlyAmountPence: median(rows.slice(-3).map((r) => r.pence)),
      priceRise: detectPriceRise(rows),
    })
  }
  return out.sort((a, b) => b.monthlyAmountPence - a.monthlyAmountPence)
}

// ── saving vs best offer ──────────────────────────────────────────────────────────────────────

export function computeOpportunity(
  p: RecurringPayment,
  offers: OfferBook,
  source: BankFigureSource
): BankOpportunity {
  const monthlyGbp = p.monthlyAmountPence / 100
  const annualGbp = Math.round(monthlyGbp * 12 * 100) / 100
  const raw = offers[p.category] ?? null
  // Never "switch" someone to the supplier they are already with.
  const offer = raw && raw.providerName.trim().toLowerCase() !== p.displayName.trim().toLowerCase() ? raw : null

  let saving: number | null = null
  let basis: BankOpportunity['savingBasis'] = null
  if (offer) {
    if (typeof offer.annualPriceGbp === 'number' && offer.annualPriceGbp > 0) {
      const diff = Math.round(annualGbp - offer.annualPriceGbp)
      if (diff > 0) {
        saving = diff
        basis = 'your_spend'
      }
    } else if (typeof offer.verifiedSavingGbp === 'number' && offer.verifiedSavingGbp > 0) {
      saving = Math.round(offer.verifiedSavingGbp)
      basis = 'typical'
    }
  }
  return {
    category: p.category,
    journey: CATEGORY_JOURNEY[p.category],
    supplierName: p.displayName,
    monthlyGbp,
    annualGbp,
    priceRise: p.priceRise,
    offer,
    savingGbpPerYear: saving,
    savingBasis: basis,
    source,
  }
}

export function analyseTransactions(
  transactions: readonly BankTransaction[],
  opts: { offers: OfferBook; source: BankFigureSource }
): BankAnalysis {
  const recurring = detectRecurring(transactions)
  const switchable = recurring.filter((p) => p.category !== 'subscription' && p.category !== 'other')
  return {
    source: opts.source,
    recurring,
    monthlyRecurringTotalPence: recurring.reduce((s, p) => s + p.monthlyAmountPence, 0),
    opportunities: switchable.map((p) => computeOpportunity(p, opts.offers, opts.source)),
  }
}

/**
 * Offers used with the sample provider. These are sample figures, not real tariffs: any saving
 * computed from them carries source "sample" and the UI badges it "Sample data".
 */
export const SAMPLE_OFFER_BOOK: OfferBook = {
  energy: {
    category: 'energy',
    providerName: 'Octopus Energy',
    url: 'https://octopus.energy/',
    annualPriceGbp: 1590,
    sourceName: 'Sample offer data',
  },
  broadband: {
    category: 'broadband',
    providerName: 'Plusnet',
    url: 'https://www.plus.net/',
    annualPriceGbp: 336,
    sourceName: 'Sample offer data',
  },
  mobile: {
    category: 'mobile',
    providerName: 'giffgaff',
    url: 'https://www.giffgaff.com/',
    annualPriceGbp: 180,
    sourceName: 'Sample offer data',
  },
}
