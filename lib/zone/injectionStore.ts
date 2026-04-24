/**
 * In-memory store for OpenClaw-injected Zone tip cards.
 * GET /api/zone/injections reads from here; POST /api/openclaw/inject writes.
 * For production at scale, replace with DB (e.g. zone_injections table).
 */

import type { ZoneTipCard } from './buildZoneViewModel'

let store: ZoneTipCard[] = []

export function getStoredInjections(): ZoneTipCard[] {
  return [...store]
}

export function setStoredInjections(cards: ZoneTipCard[]): void {
  store = cards
}

export function appendStoredInjections(cards: ZoneTipCard[]): void {
  const seen = new Set(store.map((c) => c.id))
  for (const c of cards) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      store.push(c)
    }
  }
  // Keep at most 6 (match MAX_TIP_SLOTS)
  if (store.length > 6) store = store.slice(-6)
}
