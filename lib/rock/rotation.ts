/**
 * The Rock rotation: 60 habits ÷ 2 per trickle = 30-trickle full cycle.
 * Six visible slots; each time the visitor's local clock crosses into a new
 * morning/afternoon/evening period (see lib/zone/timeOfDay.ts — the same clock the "Morning
 * tips."/"Afternoon tips." heading already uses), replace the two oldest *unliked* slots with
 * fresh picks from the pool. Was previously keyed to a UTC calendar day, so the visible tips
 * only changed once every 24 hours regardless of time of day — the heading would say "Afternoon
 * tips." or "Evening tips." next to the exact same cards shown that morning.
 */
import { ROCK_HABITS, ROCK_BY_SLUG, ROCK_HABIT_COUNT } from '@/lib/rock/habitsCatalog'
import type { RockHabit } from '@/lib/rock/types'
import { getUkSeason } from '@/lib/zone/seasonHint'
import { sortRockHabitsBySeasonStable } from '@/lib/zone/seasonRail'
import { getTimeOfDay } from '@/lib/zone/timeOfDay'

const STORAGE_KEY = 'zz_rock_rotation_v2'

type Slot = { slug: string; placedAt: number }

export type RockRotationState = {
  version: 2
  slots: Slot[]
  /** e.g. "2026-09-29-morning" — the local calendar day + time-of-day period last trickled. */
  lastTricklePeriod: string
}

export function utcDayIndex(t = Date.now()): number {
  return Math.floor(t / 86_400_000)
}

/** Local calendar day + time-of-day period key — trickle point, not just a UTC day boundary. */
export function localTricklePeriodKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}-${getTimeOfDay(date)}`
}

function parseState(raw: string | null): RockRotationState | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as RockRotationState
    if (o?.version !== 2 || !Array.isArray(o.slots) || typeof o.lastTricklePeriod !== 'string') {
      return null
    }
    return o
  } catch {
    return null
  }
}

export function readRockRotationState(): RockRotationState | null {
  if (typeof window === 'undefined') return null
  try {
    return parseState(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function writeRockRotationState(s: RockRotationState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Deterministic shuffle from seed (per-user stable order). */
function seededOrder(seed: string): string[] {
  const slugs = ROCK_HABITS.map((h) => h.slug)
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out = [...slugs]
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function pickFreshSlugs(
  exclude: Set<string>,
  liked: Set<string>,
  need: number
): string[] {
  const season = getUkSeason()
  const pool = sortRockHabitsBySeasonStable(ROCK_HABITS, season)
  const out: string[] = []
  for (const h of pool) {
    if (out.length >= need) break
    if (exclude.has(h.slug) || liked.has(`rock-${h.slug}`)) continue
    out.push(h.slug)
  }
  if (out.length < need) {
    for (const h of pool) {
      if (out.length >= need) break
      if (exclude.has(h.slug)) continue
      if (!out.includes(h.slug)) out.push(h.slug)
    }
  }
  return out.slice(0, need)
}

function pickReplacementSlug(slotIndex: number, slots: Slot[], liked: Set<string>): string | null {
  const exclude = new Set(
    slots
      .map((s, i) => (i === slotIndex ? null : s.slug))
      .filter((s): s is string => typeof s === 'string')
  )
  const season = getUkSeason()
  const pool = sortRockHabitsBySeasonStable(ROCK_HABITS, season)
  for (const h of pool) {
    if (exclude.has(h.slug)) continue
    if (liked.has(`rock-${h.slug}`)) continue
    return h.slug
  }
  for (const h of pool) {
    if (!exclude.has(h.slug)) return h.slug
  }
  return null
}

function ensureSixSlots(prev: RockRotationState | null, seed: string, likedIds: string[]): RockRotationState {
  const liked = new Set(likedIds)
  const now = Date.now()
  const period = localTricklePeriodKey(new Date(now))

  if (!prev || prev.slots.length !== 6) {
    const order = seededOrder(seed)
    const slots: Slot[] = order.slice(0, 6).map((slug) => ({ slug, placedAt: now }))
    return { version: 2, slots, lastTricklePeriod: period }
  }

  let { slots, lastTricklePeriod } = prev

  if (period !== lastTricklePeriod) {
    const visible = new Set(slots.map((s) => s.slug))
    const unlikedSlots = slots
      .map((s, i) => ({ ...s, i }))
      .filter((s) => !liked.has(`rock-${s.slug}`))
      .sort((a, b) => a.placedAt - b.placedAt)

    const toReplace = unlikedSlots.slice(0, 2)
    if (toReplace.length > 0) {
      const fresh = pickFreshSlugs(visible, liked, toReplace.length)
      const next = [...slots]
      toReplace.forEach((slot, j) => {
        const nu = fresh[j]
        if (nu && ROCK_BY_SLUG.has(nu)) {
          next[slot.i] = { slug: nu, placedAt: now }
        }
      })
      slots = next
    }
    lastTricklePeriod = period
  }

  return { version: 2, slots, lastTricklePeriod }
}

function stateSlotsSignature(s: RockRotationState): string {
  return JSON.stringify(s.slots.map((x) => x.slug))
}

/**
 * Apply morning/afternoon/evening trickle + init; persist if changed. Returns the six visible habits.
 */
export function syncRockRotation(likedCardIds: string[], seed: string): RockHabit[] {
  const prev = readRockRotationState()
  const next = ensureSixSlots(prev, seed, likedCardIds)
  if (!prev || stateSlotsSignature(prev) !== stateSlotsSignature(next) || prev.lastTricklePeriod !== next.lastTricklePeriod) {
    writeRockRotationState(next)
  }
  return next.slots
    .map((s) => ROCK_BY_SLUG.get(s.slug))
    .filter((h): h is RockHabit => h != null)
}

/**
 * Swap a Rock slot for a fresh habit (zip-shutter handoff).
 * Called after **embedded journey answer** (OrbaLogic); Like only saves to /likes and stays on the tile.
 */
export function replaceRockSlotAfterLike(likedSlug: string, likedCardIds: string[]): RockHabit | null {
  const prev = readRockRotationState()
  if (!prev || prev.slots.length !== 6) return null
  const idx = prev.slots.findIndex((s) => s.slug === likedSlug)
  if (idx < 0) return null
  const liked = new Set(likedCardIds)
  const fresh = pickReplacementSlug(idx, prev.slots, liked)
  if (!fresh || !ROCK_BY_SLUG.has(fresh)) return null
  const now = Date.now()
  const nextSlots = [...prev.slots]
  nextSlots[idx] = { slug: fresh, placedAt: now }
  const next: RockRotationState = { ...prev, slots: nextSlots }
  writeRockRotationState(next)
  return ROCK_BY_SLUG.get(fresh) ?? null
}

export function rockRotationDebug(): { pool: number; trickleDay: number } {
  return { pool: ROCK_HABIT_COUNT, trickleDay: utcDayIndex() }
}
