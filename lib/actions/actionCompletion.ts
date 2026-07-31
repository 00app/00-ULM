/**
 * "I've done this" storage for library actions.
 *
 * Signed-in users persist to `user_actioned_cards` via /api/actioned (which already existed for
 * the Truth vs Potential ledger). Guests persist to localStorage under the same shape, so the
 * ranker consumes one type regardless of who's looking and a guest who later signs up doesn't
 * lose their history.
 *
 * Timestamps are the point. Suppression is recurrence-aware — a one-off claim never returns, an
 * annual one comes back after a year, a habit never hides — and none of that is expressible with
 * a plain "done" flag, which is why this stores when rather than whether.
 */

import type { ActionCompletion } from '@/lib/actions/actionTypes'
import { actionCardId } from '@/lib/actions/actionCards'

const GUEST_KEY = 'zz_action_completions'

/** Card id (`journey-<actionId>`) back to the bare action id. */
export function actionIdFromCardId(cardId: string): string | null {
  const id = String(cardId ?? '').trim()
  if (!id.startsWith('journey-')) return null
  const rest = id.slice('journey-'.length)
  return rest || null
}

export function readGuestCompletions(): ActionCompletion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (r): r is ActionCompletion =>
          Boolean(r) &&
          typeof r === 'object' &&
          typeof (r as ActionCompletion).actionId === 'string' &&
          typeof (r as ActionCompletion).completedAt === 'string'
      )
      .map((r) => ({ actionId: r.actionId, completedAt: r.completedAt }))
  } catch {
    return []
  }
}

function writeGuestCompletions(rows: ActionCompletion[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(rows.slice(0, 500)))
  } catch {
    /* blocked storage — completion is a nicety, never break the wall for it */
  }
}

/** Marks done locally and returns the new list. Re-completing refreshes the timestamp. */
export function markGuestCompleted(actionId: string, now: Date = new Date()): ActionCompletion[] {
  const id = String(actionId ?? '').trim()
  if (!id) return readGuestCompletions()
  const rows = readGuestCompletions().filter((r) => r.actionId !== id)
  rows.unshift({ actionId: id, completedAt: now.toISOString() })
  writeGuestCompletions(rows)
  return rows
}

export function clearGuestCompletion(actionId: string): ActionCompletion[] {
  const id = String(actionId ?? '').trim()
  const rows = readGuestCompletions().filter((r) => r.actionId !== id)
  writeGuestCompletions(rows)
  return rows
}

/**
 * Merge server and local completions, newest wins per action.
 *
 * The server has no timestamp column exposed today, so rows arriving without one are dated to
 * the epoch — meaning an ANNUAL action recorded server-side is treated as long past and becomes
 * available again, rather than being hidden forever on the strength of a date we don't have.
 * Better to re-offer something occasionally than to permanently bury a yearly entitlement.
 */
export function mergeCompletions(
  server: ActionCompletion[],
  local: ActionCompletion[]
): ActionCompletion[] {
  const byId = new Map<string, ActionCompletion>()
  for (const row of [...server, ...local]) {
    if (!row?.actionId) continue
    const existing = byId.get(row.actionId)
    if (!existing || Date.parse(row.completedAt) > Date.parse(existing.completedAt)) {
      byId.set(row.actionId, row)
    }
  }
  return Array.from(byId.values())
}

/** Server rows are card ids; convert to action ids and drop anything not action-shaped. */
export function completionsFromActionedCardIds(
  cardIds: string[],
  completedAt = new Date(0).toISOString()
): ActionCompletion[] {
  const out: ActionCompletion[] = []
  for (const cardId of cardIds ?? []) {
    const actionId = actionIdFromCardId(cardId)
    if (actionId) out.push({ actionId, completedAt })
  }
  return out
}

/** POST a completion for a signed-in user. Resolves false when not signed in or on error. */
export async function postActionedCard(actionId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/actioned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ card_id: actionCardId(actionId) }),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { actioned?: boolean }
    return Boolean(body.actioned)
  } catch {
    return false
  }
}

export async function fetchServerCompletions(): Promise<ActionCompletion[]> {
  try {
    const res = await fetch('/api/actioned', { credentials: 'include', cache: 'no-store' })
    if (!res.ok) return []
    const body = (await res.json()) as { actioned_card_ids?: string[] }
    return completionsFromActionedCardIds(body.actioned_card_ids ?? [])
  } catch {
    return []
  }
}
