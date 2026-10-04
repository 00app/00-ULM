/**
 * Bank connection status on the user profile: none | sample | live, plus snoozedUntil.
 *
 * Client-side source of truth is localStorage (like every other profile field); for signed-in
 * users the same state is mirrored to `users.user_genome.bank_connection` via /api/profile/bank
 * and restored on login by syncLocalStorageFromServerUser. No transactions are ever stored —
 * only this status and a snooze date.
 */

import type { BankConnectionStatus } from '@/lib/bank/types'

export const BANK_CONNECTION_STORAGE_KEY = 'zz_bank_connection_v1'
export const BANK_CONNECTION_EVENT = 'zz-bank-connection'
export const BANK_SNOOZE_DAYS = 7

export type BankConnectionState = {
  status: BankConnectionStatus
  /** ISO timestamp; the Connect card stays hidden until then. */
  snoozedUntil: string | null
}

export const DEFAULT_BANK_STATE: BankConnectionState = { status: 'none', snoozedUntil: null }

function isStatus(v: unknown): v is BankConnectionStatus {
  return v === 'none' || v === 'sample' || v === 'live'
}

export function parseBankState(raw: unknown): BankConnectionState {
  if (!raw || typeof raw !== 'object') return DEFAULT_BANK_STATE
  const o = raw as Record<string, unknown>
  const status = isStatus(o.status) ? o.status : 'none'
  const snoozedUntil =
    typeof o.snoozedUntil === 'string' && Number.isFinite(Date.parse(o.snoozedUntil)) ? o.snoozedUntil : null
  return { status, snoozedUntil }
}

export function readBankState(): BankConnectionState {
  if (typeof window === 'undefined') return DEFAULT_BANK_STATE
  try {
    const raw = localStorage.getItem(BANK_CONNECTION_STORAGE_KEY)
    return raw ? parseBankState(JSON.parse(raw)) : DEFAULT_BANK_STATE
  } catch {
    return DEFAULT_BANK_STATE
  }
}

/** Fire-and-forget mirror to the profile. Guests get a 401, which is expected and ignored. */
function mirrorToServer(state: BankConnectionState): void {
  try {
    void fetch('/api/profile/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(state),
    }).catch(() => undefined)
  } catch {
    /* offline */
  }
}

export function writeBankState(state: BankConnectionState, opts: { mirror?: boolean } = {}): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BANK_CONNECTION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent(BANK_CONNECTION_EVENT))
  if (opts.mirror !== false) mirrorToServer(state)
}

/** True while the "Connect your bank" rail card is snoozed. */
export function isBankCardSnoozed(state: BankConnectionState, now: Date = new Date()): boolean {
  if (!state.snoozedUntil) return false
  return Date.parse(state.snoozedUntil) > now.getTime()
}

export function snoozeUntil(now: Date = new Date(), days: number = BANK_SNOOZE_DAYS): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString()
}

/** The Connect card shows only for unconnected users who haven't snoozed it. */
export function shouldShowBankConnectCard(state: BankConnectionState, now: Date = new Date()): boolean {
  return state.status === 'none' && !isBankCardSnoozed(state, now)
}
