/**
 * In-memory store for server-injected Zone tip cards, keyed per requester (see
 * `resolveMemoryScopeKey`/`userScopeKey` in `lib/requestAuth.ts`).
 *
 * Two kinds of writer share this store and always did:
 * - Personal: a specific person's own discovery-birth card (POST /api/zone/injections,
 *   /api/zone/injections/achievement, /api/research/question-card) or their own refreshed
 *   tips deck (POST /api/zone/tips-refresh) — scoped to that one person's key.
 * - Broadcast: the gateway push (POST /api/zone/tips-inject, no end-user identity) and the
 *   ZeroHunter cron pulse (POST /api/agents/pulse, which DOES know the target userId per
 *   iteration and scopes to it directly) — the former has no specific person to scope to, so
 *   it writes to `GLOBAL_INJECTION_KEY`.
 *
 * Before this was one unkeyed module-level array: on a warm serverless instance handling
 * concurrent requests from different people, one person's personal card (or the cron pulse's
 * per-user card, built from THEIR top-unspent profile) could be read back by a completely
 * different guest hitting GET /api/zone/injections next. GET now merges the broadcast bucket
 * with the caller's own personal bucket instead of reading one shared pool.
 *
 * For production at scale, replace with DB (e.g. zone_injections table).
 */

import type { ZoneTipCard } from './buildZoneViewModel'

export const GLOBAL_INJECTION_KEY = 'gateway:broadcast'

/** Best-effort cap on distinct keys — this is a request-lifetime cache, not the system of record. */
const MAX_KEYS = 1000
const MAX_CARDS_PER_KEY = 6

const stores = new Map<string, ZoneTipCard[]>()

function evictIfNeeded(): void {
  while (stores.size > MAX_KEYS) {
    const oldest = stores.keys().next().value
    if (oldest === undefined) break
    stores.delete(oldest)
  }
}

export function getStoredInjections(key: string): ZoneTipCard[] {
  return [...(stores.get(key) ?? [])]
}

/** Broadcast bucket + the caller's own personal bucket, deduped by id (broadcast first). */
export function getStoredInjectionsMerged(personalKey: string): ZoneTipCard[] {
  const merged = [...getStoredInjections(GLOBAL_INJECTION_KEY)]
  const seen = new Set(merged.map((c) => c.id))
  for (const card of getStoredInjections(personalKey)) {
    if (!seen.has(card.id)) {
      seen.add(card.id)
      merged.push(card)
    }
  }
  return merged
}

export function setStoredInjections(key: string, cards: ZoneTipCard[]): void {
  stores.delete(key)
  stores.set(key, cards)
  evictIfNeeded()
}

export function appendStoredInjections(key: string, cards: ZoneTipCard[]): void {
  const existing = stores.get(key) ?? []
  const seen = new Set(existing.map((c) => c.id))
  const next = [...existing]
  for (const c of cards) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      next.push(c)
    }
  }
  stores.delete(key)
  stores.set(key, next.length > MAX_CARDS_PER_KEY ? next.slice(-MAX_CARDS_PER_KEY) : next)
  evictIfNeeded()
}
