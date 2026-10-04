/**
 * Switch state per bank-derived opportunity + the savings tracker total.
 *
 *   available → (tap Switch, partner link opens) → clicked → (user confirms) → switched
 *
 * Only CONFIRMED switches count towards the tracker. Sample-sourced savings are kept in their
 * own total and never added to the real one. Stored locally; the click and the confirmation are
 * also logged as funnel events by the caller.
 */

import type { BankFigureSource } from '@/lib/bank/types'

export const SWITCH_RECORDS_STORAGE_KEY = 'zz_switch_records_v1'
export const SWITCH_RECORDS_EVENT = 'zz-switch-records'

export type SwitchState = 'clicked' | 'switched'

export type SwitchRecord = {
  /** Stable key for the opportunity, e.g. "energy:British Gas". */
  key: string
  fromSupplier: string
  toProvider: string
  savingGbpPerYear: number
  source: BankFigureSource
  state: SwitchState
  clickedAt: string
  switchedAt: string | null
}

export type SwitchRecords = Record<string, SwitchRecord>

export function opportunityKey(category: string, supplierName: string): string {
  return `${category}:${supplierName}`
}

export function parseSwitchRecords(raw: unknown): SwitchRecords {
  if (!raw || typeof raw !== 'object') return {}
  const out: SwitchRecords = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    const state = r.state === 'switched' ? 'switched' : r.state === 'clicked' ? 'clicked' : null
    const source = r.source === 'live' ? 'live' : r.source === 'sample' ? 'sample' : null
    if (!state || !source) continue
    if (typeof r.savingGbpPerYear !== 'number' || !Number.isFinite(r.savingGbpPerYear) || r.savingGbpPerYear <= 0) continue
    out[k] = {
      key: k,
      fromSupplier: typeof r.fromSupplier === 'string' ? r.fromSupplier : '',
      toProvider: typeof r.toProvider === 'string' ? r.toProvider : '',
      savingGbpPerYear: Math.round(r.savingGbpPerYear),
      source,
      state,
      clickedAt: typeof r.clickedAt === 'string' ? r.clickedAt : '',
      switchedAt: typeof r.switchedAt === 'string' ? r.switchedAt : null,
    }
  }
  return out
}

export function readSwitchRecords(): SwitchRecords {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SWITCH_RECORDS_STORAGE_KEY)
    return raw ? parseSwitchRecords(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

function write(records: SwitchRecords): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SWITCH_RECORDS_STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent(SWITCH_RECORDS_EVENT))
}

// ── pure transitions (tested) ─────────────────────────────────────────────────────────────────

export function withClicked(
  records: SwitchRecords,
  r: Omit<SwitchRecord, 'state' | 'clickedAt' | 'switchedAt'>,
  now: Date = new Date()
): SwitchRecords {
  const existing = records[r.key]
  // Re-clicking a link never un-switches a confirmed switch.
  if (existing?.state === 'switched') return records
  return { ...records, [r.key]: { ...r, state: 'clicked', clickedAt: now.toISOString(), switchedAt: null } }
}

export function withSwitched(records: SwitchRecords, key: string, now: Date = new Date()): SwitchRecords {
  const existing = records[key]
  // You can only confirm a switch you started from a card.
  if (!existing) return records
  return { ...records, [key]: { ...existing, state: 'switched', switchedAt: now.toISOString() } }
}

export function withReset(records: SwitchRecords, key: string): SwitchRecords {
  const existing = records[key]
  if (!existing || existing.state === 'switched') return records
  const { [key]: _drop, ...rest } = records
  return rest
}

export type SavingsTotals = {
  /** Confirmed switches from live bank data. */
  realGbp: number
  realCount: number
  /** Confirmed switches from sample data. Never added to `realGbp`. */
  sampleGbp: number
  sampleCount: number
}

export function savingsTotals(records: SwitchRecords): SavingsTotals {
  const t: SavingsTotals = { realGbp: 0, realCount: 0, sampleGbp: 0, sampleCount: 0 }
  for (const r of Object.values(records)) {
    if (r.state !== 'switched') continue
    if (r.source === 'sample') {
      t.sampleGbp += r.savingGbpPerYear
      t.sampleCount += 1
    } else {
      t.realGbp += r.savingGbpPerYear
      t.realCount += 1
    }
  }
  return t
}

// ── side-effecting wrappers ───────────────────────────────────────────────────────────────────

export function recordClick(r: Omit<SwitchRecord, 'state' | 'clickedAt' | 'switchedAt'>): void {
  write(withClicked(readSwitchRecords(), r))
}
export function recordSwitched(key: string): void {
  write(withSwitched(readSwitchRecords(), key))
}
export function recordReset(key: string): void {
  write(withReset(readSwitchRecords(), key))
}
