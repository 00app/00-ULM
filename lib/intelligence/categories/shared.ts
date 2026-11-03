/**
 * Small building blocks the 13 category specs share. Nothing here invents a value: every helper
 * returns null when the fact it reads is unknown.
 */

import type { MetricSpec, MetricUnit, MetricValue, OptionSpec, SpecContext } from '@/lib/intelligence/categories/types'

/** Pence (how accounts store money) → pounds for display, to the penny. */
export const pounds = (pence: number) => Math.round(pence) / 100

/** A metric that is simply one fact, shown as-is. */
export function factMetric(key: string, label: string, unit: MetricUnit, computeNote = 'The fact as we hold it.'): MetricSpec {
  return {
    key,
    label,
    unit,
    needs: [key],
    computeNote,
    compute: (ctx) => {
      const f = ctx.fact(key)
      if (!f || Array.isArray(f.value) || typeof f.value === 'object') return null
      const value =
        typeof f.value === 'boolean'
          ? f.value
            ? 'Yes'
            : 'No'
          : unit === 'gbp_month' && typeof f.value === 'number' && f.unit === 'pence_month'
            ? pounds(f.value)
            : unit === 'gbp_year' && typeof f.value === 'number' && f.unit === 'pence_year'
              ? pounds(f.value)
              : f.value
      return { value, from: [key] }
    },
  }
}

/** Soonest of several date facts, as a metric. */
export function soonestDateMetric(key: string, label: string, facts: string[]): MetricSpec {
  return {
    key,
    label,
    unit: 'date',
    needs: [facts[0]],
    computeNote: `The soonest of ${facts.join(', ')}.`,
    compute: (ctx) => {
      const dated = facts.map((k) => ({ k, d: ctx.date(k) })).filter((x): x is { k: string; d: string } => x.d !== null)
      if (dated.length === 0) return null
      dated.sort((a, b) => a.d.localeCompare(b.d))
      return { value: dated[0].d, from: [dated[0].k] }
    },
  }
}

/** Sum of monthly prices in a list fact (streaming services, memberships…), in pounds. */
export function listMonthlyTotal(ctx: SpecContext, key: string): MetricValue | null {
  const items = ctx.list(key)
  if (!items || items.length === 0) return null
  const prices = items.map((i) => (typeof i.monthlyPence === 'number' ? i.monthlyPence : null))
  if (prices.some((p) => p === null)) return null
  return { value: pounds((prices as number[]).reduce((s, p) => s + p, 0)), from: [key] }
}

export const within = (days: number | null, lo: number, hi: number) => days !== null && days >= lo && days <= hi

export const isAnswer = (v: string | null, ...accepted: string[]) => v !== null && accepted.includes(v)

/** Heating season, October to March (the same window the library's heating actions use). */
export const inHeatingSeason = (month: number) => month >= 10 || month <= 3

export const OPTION_NOT_NOW: OptionSpec = {
  key: 'not_now',
  label: 'Not now',
  effortMinutes: 0,
  approvalTier: 0,
  tradeOff: 'Nothing changes, and we will not ask again for 30 days.',
  prepares: 'none',
}

export function remindMe(days: number, label = `Remind me in ${days} days`): OptionSpec {
  return {
    key: `remind_${days}`,
    label,
    effortMinutes: 1,
    approvalTier: 1,
    tradeOff: 'You keep the current price until you act.',
    prepares: 'reminder',
  }
}

/** Human date for findings: "12 June 2026". */
export function longDate(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : iso
}

/** Whole months between two dates, floored, never negative. */
export function monthsSince(iso: string, now: Date): number {
  const d = new Date(iso)
  const months = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth())
  return Math.max(0, now.getUTCDate() < d.getUTCDate() ? months - 1 : months)
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
