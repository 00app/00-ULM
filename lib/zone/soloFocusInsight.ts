/**
 * Solo Focus deep view (Z9): run a category's rules against what this browser knows.
 *
 * Reads the onboarding profile, journey answers and loop/card answers from localStorage, builds
 * the household (lib/household, pure), and evaluates the card's category spec. Everything the
 * rules decide (findings, options, figures) comes from code and the action library; nothing here
 * is generated. Public (L0) data is looked up server-side and is not part of this pass yet, so
 * those facts stay unknown rather than guessed.
 */

import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import type { ZoneAction } from '@/lib/actions/actionTypes'
import { buildHousehold, type Household } from '@/lib/household/buildHousehold'
import { evaluateCategory, specContext, type CategoryEvaluation } from '@/lib/intelligence/categories/evaluate'
import { CATEGORY_SPECS } from '@/lib/intelligence/categories/registry'
import { JOURNEY_IDS, type JourneyId } from '@/lib/journeys'
import type { InsightCard, InsightCategory } from '@/lib/zone/insightCard'
import { persistLoopAnswerLocal } from '@/lib/zone/loopMemory'
import { sendKnowledgeAnswer } from '@/lib/knowledge/client'
import type { KnowledgeSource } from '@/lib/knowledge/questions'

const PROFILE_KEYS: Record<string, string> = {
  homeOwnership: 'profile_home_ownership',
  financialPressure: 'profile_financial_pressure',
  livingSituation: 'profile_household',
  children: 'profile_children',
  employmentStatus: 'profile_employment_status',
  age: 'profile_age',
  powerType: 'profile_home_power',
  energySupplier: 'profile_energy_supplier',
  transport: 'profile_transport',
  washPreference: 'profile_wash_preference',
  home_type: 'profile_home_type',
}

const SKIP_KEY = 'zz_sf_card_q_skips'
const SKIP_DAYS = 30

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readJson<T>(key: string): T | null {
  const raw = read(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function clientProfile(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [field, key] of Object.entries(PROFILE_KEYS)) {
    const v = read(key)?.trim()
    if (v && v !== 'SKIP') out[field] = v
  }
  return out
}

function clientJourneyAnswers(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const id of JOURNEY_IDS) {
    const map = readJson<Record<string, unknown>>(`journey_${id}_answers`)
    if (map && typeof map === 'object') out[id] = map
  }
  return out
}

/** `zz_loop_answers_log` is keyed `journey::questionId`; the household wants questionId → answer. */
function clientLoopAnswers(): Record<string, string> {
  const log = readJson<Record<string, string>>('zz_loop_answers_log') ?? {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(log)) {
    const qid = k.split('::')[1]
    if (qid && typeof v === 'string' && v.trim()) out[qid] = v
  }
  return out
}

export function categoryForJourney(journeyId: string | null | undefined): InsightCategory | null {
  const id = String(journeyId ?? '').trim().toLowerCase()
  return id in CATEGORY_SPECS ? (id as InsightCategory) : null
}

/** This browser's household (profile, journey answers, loop and card answers). Null on the server. */
export function clientHousehold(now: Date = new Date()): Household | null {
  if (typeof window === 'undefined') return null
  const postcode = read('profile_postcode')?.trim() || null
  const asOf = now.toISOString()
  return buildHousehold(
    {
      identity: { kind: 'guest', guestSessionId: 'browser' },
      postcode,
      profile: clientProfile(),
      profileAsOf: null,
      journeyAnswers: clientJourneyAnswers(),
      journeyAnswersAsOf: null,
      loopAnswers: clientLoopAnswers(),
      loopAnswersAsOf: asOf,
      property: null,
      accounts: [],
      bank: null,
      storedFacts: [],
    },
    now
  )
}

/** Evaluate one category for this browser's household. Null on the server or for an unknown id. */
export function evaluateClientCategory(category: InsightCategory, now: Date = new Date()): CategoryEvaluation | null {
  const h = clientHousehold(now)
  return h ? evaluateCategory(CATEGORY_SPECS[category], specContext(h, now)) : null
}

/** Questions-and-answers this browser holds: questionId → stored answer (loop log). */
export function clientAnswers(): Record<string, string> {
  return clientLoopAnswers()
}

/** Store an answer where the household builder reads it (journey map + loop log), and server-side. */
export function persistCardAnswer(
  journeyId: JourneyId,
  questionId: string,
  answer: string,
  source: KnowledgeSource = 'solo_focus'
): void {
  persistLoopAnswerLocal({ journeyId, questionId, answer })
  sendKnowledgeAnswer({ questionId, journeyId, answer, source })
}

function readSkips(): Record<string, number> {
  return readJson<Record<string, number>>(SKIP_KEY) ?? {}
}

/** Skipped (or "not sure") questions wait 30 days before Solo Focus asks again. */
export function isQuestionResting(questionId: string, now: number = Date.now()): boolean {
  const at = readSkips()[questionId]
  return typeof at === 'number' && now - at < SKIP_DAYS * 86_400_000
}

export function restQuestion(
  questionId: string,
  now: number = Date.now(),
  journeyId?: JourneyId,
  source: KnowledgeSource = 'solo_focus'
): void {
  const skips = readSkips()
  skips[questionId] = now
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify(skips))
  } catch {
    /* quota */
  }
  if (journeyId) sendKnowledgeAnswer({ questionId, journeyId, answer: null, source })
}

/**
 * The finding to lead with: the one built on this card's own library action, else the one with
 * the biggest sourced saving, else the first. Coming soon cards never lead.
 */
export function pickBestCard(cards: InsightCard[], cardActionId: string | null): InsightCard | null {
  const real = cards.filter((c) => c.statusTag !== 'coming_soon')
  if (real.length === 0) return null
  if (cardActionId) {
    const own = real.find((c) => c.options.some((o) => o.actionId === cardActionId))
    if (own) return own
  }
  const value = (c: InsightCard) => c.saving?.gbpRange?.high ?? 0
  return [...real].sort((a, b) => value(b) - value(a))[0] ?? real[0]
}

export function libraryAction(actionId: string | null | undefined): ZoneAction | null {
  if (!actionId) return null
  return ZONE_ACTIONS.find((a) => a.id === actionId) ?? null
}

/** One plain "how" line for an option, from its library action only (no invented specifics). */
export function howToLine(action: ZoneAction, effortMinutes: number | null): string {
  let host = ''
  try {
    host = new URL(action.url).hostname.replace(/^www\./, '')
  } catch {
    /* keep empty */
  }
  const where = host ? ` on ${host}` : ''
  const open =
    action.verb === 'CLAIM'
      ? `Use the free checker${where}.`
      : action.verb === 'SWITCH'
        ? `Compare deals${where}.`
        : action.verb === 'BUY'
          ? `Compare options${where}.`
          : `Follow the guide${where}.`
  // The library line may already say how long it takes; use that so the two never disagree.
  const stated = action.detail.match(/about ([a-z0-9]+) minutes/i)?.[1]
  const minutes = stated ?? (effortMinutes ? String(effortMinutes) : null)
  return minutes ? `${open} About ${minutes} minutes.` : open
}
