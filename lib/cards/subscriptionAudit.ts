/**
 * Ask-first subscriptions card: answer storage and the personal audit.
 *
 * The card asks which subscriptions someone pays for, which plan, and how often they use each.
 * From those answers it works out what they pay and what they could stop paying. Only amounts
 * that are known (the person's own figure, or a sourced list price) are added up; anything else
 * is counted as unknown and named, never shown as £0.
 */

import { subscriptionPlan, subscriptionService, type SubscriptionKind } from '@/lib/cards/subscriptionCatalog'

export type SubscriptionUse = 'often' | 'sometimes' | 'rarely'

export type SubscriptionEntry = {
  serviceId: string
  planId: string | null
  /** What the person says they pay a month, in pence. Overrides the list price when set. */
  ownMonthlyPence: number | null
  use: SubscriptionUse | null
  /** Free-text name for "gym" and "other". */
  label?: string | null
}

export type SubscriptionAnswers = {
  entries: SubscriptionEntry[]
  answeredAt: string
}

export type AuditLine = {
  serviceId: string
  name: string
  planLabel: string | null
  monthlyPence: number | null
  /** 'own' = the person's figure, 'list' = sourced list price, null = unknown. */
  priceFrom: 'own' | 'list' | null
  use: SubscriptionUse | null
  manageUrl: string | null
}

export type AuditSuggestion =
  | { type: 'cancel_rarely'; serviceId: string; name: string; yearlyPence: number; manageUrl: string | null }
  | { type: 'overlap'; kind: SubscriptionKind; names: string[]; cheapestYearlyPence: number | null }
  | {
      type: 'downgrade'
      serviceId: string
      name: string
      fromPlan: string
      toPlan: string
      yearlyPence: number
      manageUrl: string | null
    }

export type SubscriptionAudit = {
  lines: AuditLine[]
  knownMonthlyPence: number
  unknownCount: number
  suggestions: AuditSuggestion[]
  /** Sum of distinct savings (rarely-used cancellations plus downgrades on services kept). */
  potentialYearlyPence: number
}

export const SUBSCRIPTION_ANSWERS_KEY = 'zz_card_answers_subscriptions'

export function resolveMonthlyPence(e: SubscriptionEntry): { pence: number | null; from: 'own' | 'list' | null } {
  if (typeof e.ownMonthlyPence === 'number' && e.ownMonthlyPence > 0) return { pence: e.ownMonthlyPence, from: 'own' }
  const plan = subscriptionPlan(e.serviceId, e.planId)
  if (plan?.monthlyPence != null && plan.monthlyPence > 0) return { pence: plan.monthlyPence, from: 'list' }
  return { pence: null, from: null }
}

const OVERLAP_KINDS: SubscriptionKind[] = ['music']

export function buildSubscriptionAudit(entries: SubscriptionEntry[]): SubscriptionAudit {
  const lines: AuditLine[] = entries.map((e) => {
    const svc = subscriptionService(e.serviceId)
    const plan = subscriptionPlan(e.serviceId, e.planId)
    const price = resolveMonthlyPence(e)
    const name = (e.serviceId === 'gym' || e.serviceId === 'other') && e.label?.trim() ? e.label.trim() : svc?.name ?? e.serviceId
    return {
      serviceId: e.serviceId,
      name,
      planLabel: plan?.label ?? null,
      monthlyPence: price.pence,
      priceFrom: price.from,
      use: e.use,
      manageUrl: svc?.manageUrl ?? null,
    }
  })

  const knownMonthlyPence = lines.reduce((s, l) => s + (l.monthlyPence ?? 0), 0)
  const unknownCount = lines.filter((l) => l.monthlyPence == null).length
  const suggestions: AuditSuggestion[] = []
  const cancelled = new Set<string>()

  // 1. Rarely used and the price is known: the clearest saving.
  for (const l of lines) {
    if (l.use === 'rarely' && l.monthlyPence != null) {
      suggestions.push({ type: 'cancel_rarely', serviceId: l.serviceId, name: l.name, yearlyPence: l.monthlyPence * 12, manageUrl: l.manageUrl })
      cancelled.add(l.serviceId)
    }
  }

  // 2. Paying twice for the same thing (two music services). Only flag, never assume which goes.
  for (const kind of OVERLAP_KINDS) {
    const same = lines.filter((l) => subscriptionService(l.serviceId)?.kind === kind && !cancelled.has(l.serviceId))
    if (same.length >= 2) {
      const known = same.map((l) => l.monthlyPence).filter((p): p is number => p != null)
      suggestions.push({
        type: 'overlap',
        kind,
        names: same.map((l) => l.name),
        cheapestYearlyPence: known.length === same.length ? Math.min(...known) * 12 : null,
      })
    }
  }

  // 3. A cheaper plan on a service they keep, where both list prices are sourced and they are
  //    not on their own figure (we cannot compare an own figure with a list price fairly).
  for (const e of entries) {
    if (cancelled.has(e.serviceId)) continue
    const svc = subscriptionService(e.serviceId)
    const plan = subscriptionPlan(e.serviceId, e.planId)
    if (!svc || !plan || plan.monthlyPence == null) continue
    if (typeof e.ownMonthlyPence === 'number' && e.ownMonthlyPence > 0) continue
    const cheaper = svc.plans
      .filter((p) => p.monthlyPence != null && p.monthlyPence < (plan.monthlyPence as number))
      .sort((a, b) => (b.monthlyPence as number) - (a.monthlyPence as number))[0]
    // Student and family plans are eligibility or household choices, not a plain downgrade.
    if (!cheaper || cheaper.id === 'student' || e.use === 'often') continue
    suggestions.push({
      type: 'downgrade',
      serviceId: svc.id,
      name: svc.name,
      fromPlan: plan.label,
      toPlan: cheaper.label,
      yearlyPence: ((plan.monthlyPence as number) - (cheaper.monthlyPence as number)) * 12,
      manageUrl: svc.manageUrl,
    })
  }

  const potentialYearlyPence = suggestions.reduce(
    (s, x) => s + (x.type === 'cancel_rarely' || x.type === 'downgrade' ? x.yearlyPence : 0),
    0
  )
  return { lines, knownMonthlyPence, unknownCount, suggestions, potentialYearlyPence }
}

export function formatGbpFromPence(pence: number): string {
  const gbp = pence / 100
  return `£${gbp.toLocaleString('en-GB', { minimumFractionDigits: gbp % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`
}

export function readSubscriptionAnswers(): SubscriptionAnswers | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_ANSWERS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SubscriptionAnswers
    return Array.isArray(parsed?.entries) ? parsed : null
  } catch {
    return null
  }
}

export function writeSubscriptionAnswers(entries: SubscriptionEntry[]): SubscriptionAnswers {
  const answers = { entries, answeredAt: new Date().toISOString() }
  try {
    localStorage.setItem(SUBSCRIPTION_ANSWERS_KEY, JSON.stringify(answers))
  } catch {
    /* blocked storage: the answer still shows for this visit */
  }
  return answers
}

export function clearSubscriptionAnswers(): void {
  try {
    localStorage.removeItem(SUBSCRIPTION_ANSWERS_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Save answered subscriptions to the signed-in person's bills (household_accounts). Resolves to
 * 'saved', 'signed_out' (401: answers stay on this device) or 'error'.
 */
export async function saveSubscriptionsToBills(lines: AuditLine[]): Promise<'saved' | 'signed_out' | 'error'> {
  try {
    for (const l of lines) {
      const res = await fetch('/api/household/accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'subscription',
          provider_name: l.name,
          nickname: l.planLabel,
          monthly_amount_pence: l.monthlyPence,
        }),
      })
      if (res.status === 401) return 'signed_out'
      if (!res.ok) return 'error'
    }
    return 'saved'
  } catch {
    return 'error'
  }
}
