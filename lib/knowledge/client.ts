/**
 * Knowledge gathering — client side of /api/knowledge.
 *
 * The device stays the fast cache (journey answers, loop log, Solo Focus skips in localStorage), so
 * nothing waits on the network. Each answer or skip is also sent to the server (keepalive, so it
 * survives leaving the page), and once per load the server's answers and snoozes are merged back in,
 * filling only what this device does not already know.
 */

import type { JourneyId } from '@/lib/journeys'
import type { KnowledgeSource } from '@/lib/knowledge/questions'
import { KNOWLEDGE_SNOOZE_DAYS } from '@/lib/knowledge/questions'

const SKIP_KEY = 'zz_sf_card_q_skips'
const LOOP_LOG_KEY = 'zz_loop_answers_log'
const SYNCED_EVENT = 'zz:knowledge-synced'

export function sendKnowledgeAnswer(params: {
  questionId: string
  journeyId: JourneyId
  answer: string | null
  source?: KnowledgeSource
}): void {
  if (typeof window === 'undefined') return
  const body = {
    question_id: params.questionId,
    journey_id: params.journeyId,
    status: params.answer ? 'answered' : 'skipped',
    answer: params.answer ?? undefined,
    source: params.source ?? 'solo_focus',
  }
  try {
    void fetch('/api/knowledge', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {
      /* the device cache still has it; the next answer or load carries on */
    })
  } catch {
    /* fetch unavailable */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota */
  }
}

let syncStarted = false

/**
 * Merge server answers and snoozes into this device, once per page load. Only fills gaps: an answer
 * the device already holds is never overwritten (the device may be newer than the server).
 */
export async function syncKnowledgeFromServer(): Promise<void> {
  if (typeof window === 'undefined' || syncStarted) return
  syncStarted = true
  try {
    const res = await fetch('/api/knowledge', { credentials: 'include', cache: 'no-store' })
    if (!res.ok) return
    const data = (await res.json()) as {
      answers?: { question_id: string; journey_id: string | null; answer: string }[]
      snoozed?: { question_id: string; until: string }[]
    }
    let changed = false

    const log = readJson<Record<string, string>>(LOOP_LOG_KEY) ?? {}
    for (const a of data.answers ?? []) {
      if (!a.journey_id || !a.question_id || !a.answer) continue
      const logKey = `${a.journey_id}::${a.question_id}`
      if (log[logKey]) continue
      log[logKey] = a.answer
      const mapKey = `journey_${a.journey_id}_answers`
      const map = readJson<Record<string, string>>(mapKey) ?? {}
      if (!map[a.question_id]) {
        map[a.question_id] = a.answer
        writeJson(mapKey, map)
      }
      changed = true
    }
    if (changed) writeJson(LOOP_LOG_KEY, log)

    const skips = readJson<Record<string, number>>(SKIP_KEY) ?? {}
    let skipsChanged = false
    for (const s of data.snoozed ?? []) {
      if (skips[s.question_id]) continue
      // Store when the rest started, as restQuestion does, so the 30-day window lines up.
      const until = Date.parse(s.until)
      if (!Number.isFinite(until)) continue
      skips[s.question_id] = until - KNOWLEDGE_SNOOZE_DAYS * 86_400_000
      skipsChanged = true
    }
    if (skipsChanged) writeJson(SKIP_KEY, skips)

    if (changed || skipsChanged) window.dispatchEvent(new Event(SYNCED_EVENT))
  } catch {
    /* offline: the device cache is still complete for this device */
  }
}

export function onKnowledgeSynced(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SYNCED_EVENT, cb)
  return () => window.removeEventListener(SYNCED_EVENT, cb)
}
