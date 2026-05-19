/**
 * Neon PostgreSQL — journey answers (JSONB only).
 * Reads and writes `journey_answers_jsonb` to avoid normalized-table drift.
 */

import { getDbPool } from '@/lib/db'
import { isValidLoopOrJourneyQuestion } from '@/lib/zone/loopQuestions'
import type { JourneyId } from '@/lib/journeys'

const MAX_ANSWER_LENGTH = 500

/** Map: journey_key → { question_key → answer } */
export type UserAnswersMap = Record<string, Record<string, string>>

/** All journey answers for a user — `journey_answers_jsonb` only (no normalized fallback). */
export async function getJourneyAnswersForUser(
  userId: string
): Promise<Record<JourneyId, Record<string, string>>> {
  return getJourneyAnswersJsonbOnly(userId)
}

/** Explicit JSONB read (same data as `getJourneyAnswersForUser` since v1.8.3). */
export async function getJourneyAnswersJsonbOnly(
  userId: string
): Promise<Record<JourneyId, Record<string, string>>> {
  const pool = getDbPool()
  const out: Record<string, Record<string, string>> = {}
  try {
    const jsonb = await pool.query<{ journey_id: string; answers: unknown }>(
      `SELECT journey_id, answers FROM journey_answers_jsonb WHERE user_id = $1`,
      [userId]
    )
    jsonb.rows.forEach((r) => {
      const ans = r.answers as Record<string, string>
      if (ans && typeof ans === 'object') {
        const cleaned: Record<string, string> = {}
        for (const [k, v] of Object.entries(ans)) {
          if (typeof v === 'string') cleaned[k] = v
        }
        if (Object.keys(cleaned).length > 0) out[r.journey_id] = cleaned
      }
    })
  } catch {
    // table may not exist
  }
  return out as Record<JourneyId, Record<string, string>>
}

export interface ResearchSourceCitation {
  label: string
  url?: string
  /** Explicit `research_results.source_url` for CLAIM (Ofgem / GOV.UK). */
  sourceUrl?: string
  /** Human-readable `research_results.created_at` for Solo Focus footer. */
  verifiedAt?: string
}

export interface ResearchUnitRatesRow {
  elec_unit_rate_gbp_per_kwh: number | null
  gas_unit_rate_gbp_per_kwh: number | null
  source_url: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

/**
 * Latest stored unit rates + canonical source link.
 * When `userId` is a valid UUID, prefers the latest row for that user (`research_results.user_id`).
 */
export async function getLatestResearchUnitRates(
  postcode: string | null | undefined,
  userId?: string | null
): Promise<ResearchUnitRatesRow | null> {
  const pool = getDbPool()
  const pc = postcode?.replace(/\s+/g, '').trim() || ''
  const uid = userId?.trim() ?? ''
  try {
    if (uid && isUuid(uid)) {
      const ru = await pool.query<ResearchUnitRatesRow>(
        `SELECT elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url FROM research_results
         WHERE user_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [uid]
      )
      if (
        ru.rows[0] &&
        (ru.rows[0].elec_unit_rate_gbp_per_kwh != null || ru.rows[0].gas_unit_rate_gbp_per_kwh != null)
      ) {
        return ru.rows[0]
      }
    }
    if (pc.length >= 4) {
      const r1 = await pool.query<ResearchUnitRatesRow>(
        `SELECT elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url FROM research_results
         WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [pc]
      )
      if (r1.rows[0]) return r1.rows[0]
    }
    const r2 = await pool.query<ResearchUnitRatesRow>(
      `SELECT elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url FROM research_results
       ORDER BY created_at DESC
       LIMIT 1`
    )
    return r2.rows[0] ?? null
  } catch {
    return null
  }
}

/**
 * Latest `research_results` row for citation footer (prefers `user_id`, then postcode).
 */
export async function getLatestResearchCitation(
  postcode: string | null | undefined,
  userId?: string | null
): Promise<ResearchSourceCitation | null> {
  const pool = getDbPool()
  const pc = postcode?.replace(/\s+/g, '').trim() || ''
  const uid = userId?.trim() ?? ''
  type Row = {
    citations: unknown
    markdown: string | null
    source_url: string | null
    created_at: Date | string | null
  }
  try {
    if (uid && isUuid(uid)) {
      const ru = await pool.query<Row>(
        `SELECT citations, markdown, source_url, created_at FROM research_results
         WHERE user_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [uid]
      )
      const citeU = firstCitationFromRow(ru.rows[0])
      if (citeU) return citeU
    }
    if (pc.length >= 4) {
      const r1 = await pool.query<Row>(
        `SELECT citations, markdown, source_url, created_at FROM research_results
         WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [pc]
      )
      const cite = firstCitationFromRow(r1.rows[0])
      if (cite) return cite
    }
    const r2 = await pool.query<Row>(
      `SELECT citations, markdown, source_url, created_at FROM research_results
       ORDER BY created_at DESC
       LIMIT 1`
    )
    return firstCitationFromRow(r2.rows[0])
  } catch {
    return null
  }
}

function formatResearchVerifiedAt(createdAt: Date | string | null | undefined): string | undefined {
  if (createdAt == null) return undefined
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export interface ResearchAttribution {
  headline: string | null
  supplied_by: string | null
}

/**
 * Latest headline + Supplied-by for Solo Focus / Zone (prefers `user_id`, then postcode).
 */
export async function getLatestResearchAttribution(
  postcode: string | null | undefined,
  userId?: string | null
): Promise<ResearchAttribution | null> {
  const pool = getDbPool()
  const pc = postcode?.replace(/\s+/g, '').trim() || ''
  const uid = userId?.trim() ?? ''
  type Row = { agent_headline: string | null; provider_name: string | null }
  const map = (row: Row | undefined): ResearchAttribution | null => {
    if (!row) return null
    const headline = row.agent_headline?.trim() || null
    const supplied_by = row.provider_name?.trim() || null
    if (!headline && !supplied_by) return null
    return { headline, supplied_by }
  }
  try {
    if (uid && isUuid(uid)) {
      const ru = await pool.query<Row>(
        `SELECT agent_headline, provider_name FROM research_results
         WHERE user_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [uid]
      )
      const au = map(ru.rows[0])
      if (au) return au
    }
    if (pc.length >= 4) {
      const r1 = await pool.query<Row>(
        `SELECT agent_headline, provider_name FROM research_results
         WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [pc]
      )
      const a = map(r1.rows[0])
      if (a) return a
    }
    const r2 = await pool.query<Row>(
      `SELECT agent_headline, provider_name FROM research_results
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`
    )
    return map(r2.rows[0])
  } catch {
    return null
  }
}

/**
 * Persist gateway / Hermes invoke snapshot for morph + diagnostics (`research_results.research_snapshot`).
 */
export async function insertResearchInvokeSnapshot(params: {
  userId?: string | null
  postcode?: string | null
  profileSnapshot?: Record<string, unknown> | null
  markdown: string
  citations: unknown
  sourceUrl?: string | null
  providerName?: string | null
  agentHeadline?: string | null
  /** Defaults to `agentHeadline` when omitted; maps to `architect_prose`. */
  architectProse?: string | null
  invokePayload: unknown
}): Promise<void> {
  const pool = getDbPool()
  const prose = (params.architectProse ?? params.agentHeadline)?.trim() || null
  try {
    await pool.query(
      `ALTER TABLE research_results
       ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS category TEXT,
       ADD COLUMN IF NOT EXISTS offer_url TEXT,
       ADD COLUMN IF NOT EXISTS saving_amount_gbp NUMERIC(10,2),
       ADD COLUMN IF NOT EXISTS architect_prose TEXT,
       ADD COLUMN IF NOT EXISTS research_snapshot JSONB`
    )
    await pool.query(
      `INSERT INTO research_results (
         user_id, postcode, profile_snapshot, markdown, citations,
         elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url,
         deep_link, verified_saving, category, offer_url, saving_amount_gbp, locality_context,
         provider_name, agent_headline, architect_prose, research_snapshot, created_at
       )
       VALUES (
         $1, $2, $3::jsonb, $4, $5::jsonb,
         NULL, NULL, $6,
         $6, NULL, NULL, $6, NULL::numeric, NULL,
         $7, $8, $9, $10::jsonb, NOW()
       )`,
      [
        params.userId?.trim() || null,
        params.postcode ?? null,
        JSON.stringify(params.profileSnapshot ?? {}),
        params.markdown,
        JSON.stringify(Array.isArray(params.citations) ? params.citations : []),
        params.sourceUrl ?? null,
        params.providerName?.trim() ?? null,
        params.agentHeadline?.trim() ?? null,
        prose,
        JSON.stringify(params.invokePayload ?? {}),
      ]
    )
  } catch (e) {
    console.warn('[neon] insertResearchInvokeSnapshot failed:', e)
  }
}

function firstCitationFromRow(
  row:
    | {
        citations: unknown
        markdown: string | null
        source_url?: string | null
        created_at?: Date | string | null
      }
    | undefined
): ResearchSourceCitation | null {
  if (!row) return null
  const verifiedAt = formatResearchVerifiedAt(row.created_at)
  const canonical =
    typeof row.source_url === 'string' && row.source_url.startsWith('http') ? row.source_url : undefined
  try {
    const raw = row.citations
    if (Array.isArray(raw) && raw.length > 0) {
      const c = raw[0] as { source_name?: string; url?: string; title?: string }
      const label = (c.source_name || c.title || 'source').trim()
      const urlFromCite = typeof c.url === 'string' ? c.url : undefined
      const url = canonical ?? urlFromCite
      if (label) return { label, url, sourceUrl: canonical, verifiedAt }
    }
  } catch {
    // ignore
  }
  if (canonical) {
    return { label: 'Ofgem', url: canonical, sourceUrl: canonical, verifiedAt }
  }
  return null
}

/**
 * Upsert a single answer into journey_answers_jsonb (merge into existing answers for that journey).
 * Also writes to journey_answers (normalized) so summary/zai keep working.
 */
export async function upsertJourneyAnswerJsonb(
  userId: string,
  journeyId: string,
  answerKey: string,
  answerValue: string
): Promise<void> {
  const pool = getDbPool()
  if (!isValidLoopOrJourneyQuestion(journeyId, answerKey)) return
  const safeValue = String(answerValue).slice(0, MAX_ANSWER_LENGTH)

  try {
    /* Atomic merge: jsonb_set on conflict — no read-modify-write race */
    await pool.query(
      `INSERT INTO journey_answers_jsonb (user_id, journey_id, answers, updated_at)
       VALUES ($1, $2, jsonb_build_object($3::text, to_jsonb($4::text)), NOW())
       ON CONFLICT (user_id, journey_id)
       DO UPDATE SET
         answers = jsonb_set(
           COALESCE(journey_answers_jsonb.answers, '{}'::jsonb),
           ARRAY[$3::text],
           to_jsonb($4::text),
           true
         ),
         updated_at = NOW()`,
      [userId, journeyId, answerKey, safeValue]
    )
  } catch {
    // JSONB table may not exist
  }

  await pool.query(
    `INSERT INTO journey_answers (user_id, journey_key, question_key, answer, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, journey_key, question_key)
     DO UPDATE SET answer = $4, updated_at = NOW()`,
    [userId, journeyId, answerKey, safeValue]
  )
}

/**
 * Atomic upsert of journey answers for a user (bulk; normalizes into JSONB + normalized).
 */
export async function upsertUserAnswers(
  userId: string,
  answers: UserAnswersMap
): Promise<{ updated: number }> {
  let updated = 0
  for (const [journeyKey, qMap] of Object.entries(answers)) {
    if (!journeyKey || typeof qMap !== 'object') continue
    for (const [questionKey, value] of Object.entries(qMap)) {
      if (!questionKey || value === undefined) continue
      await upsertJourneyAnswerJsonb(userId, journeyKey, questionKey, String(value))
      updated++
    }
  }
  return { updated }
}

/**
 * Mirror a Child-card answer into users.user_genome for fast recursive personalization.
 * Stores both nested journey answer and selected top-level derived fields.
 */
export async function upsertUserGenomeFromAnswer(
  userId: string,
  journeyId: string,
  questionKey: string,
  answerValue: string
): Promise<void> {
  const pool = getDbPool()
  const uid = userId?.trim()
  if (!uid) return
  const journey = String(journeyId || '').trim()
  const q = String(questionKey || '').trim()
  const value = String(answerValue ?? '').trim().slice(0, MAX_ANSWER_LENGTH)
  if (!journey || !q || !value) return

  const derivedPatch: Record<string, unknown> = {}
  const qUpper = q.toUpperCase()
  if (qUpper === 'TENURE' || qUpper === 'HOUSING_TENURE' || qUpper === 'TENURE_TYPE') {
    derivedPatch.tenure = value
    derivedPatch.tenure_type = value
  }
  if (qUpper === 'HOME_TYPE') derivedPatch.home_type = value
  if (qUpper === 'HOUSEHOLD_SIZE') {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) derivedPatch.household_size = Math.round(n)
  }
  if (qUpper === 'COMMUTE_TYPE' || qUpper === 'TRANSPORT_BASELINE') {
    derivedPatch.transport_baseline = value
  }
  if (qUpper === 'FUEL_TYPE') derivedPatch.fuel_type = value
  if (qUpper === 'PHONE_CYCLE' || qUpper === 'DEVICE_CYCLE') derivedPatch.phone_cycle = value
  if (qUpper === 'ENERGY_TYPE') derivedPatch.energy_type = value

  try {
    await pool.query(
      `UPDATE users
       SET user_genome =
         jsonb_set(
           COALESCE(user_genome, '{}'::jsonb) || $2::jsonb,
           ARRAY['journey_answers', $3::text, $4::text],
           to_jsonb($5::text),
           true
         )
       WHERE id = $1`,
      [uid, JSON.stringify(derivedPatch), journey, q, value]
    )
  } catch {
    // keep answer flow non-blocking if genome write fails
  }
}

/** Pulse / ZeroHunter: users with fewest stored answers (infinite loop “unspent”). */
export async function getTopUnspentUsersForPulse(
  limit = 5
): Promise<Array<{ id: string; postcode: string | null; home_type: string | null }>> {
  const pool = getDbPool()
  try {
    const res = await pool.query<{ id: string; postcode: string | null; home_type: string | null }>(
      `SELECT u.id, u.postcode, u.home_type
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS c FROM journey_answers GROUP BY user_id
       ) ja ON ja.user_id = u.id
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS c FROM journey_answers_jsonb GROUP BY user_id
       ) jb ON jb.user_id = u.id
       ORDER BY COALESCE(ja.c, 0) + COALESCE(jb.c, 0) ASC, u.created_at DESC NULLS LAST
       LIMIT $1`,
      [limit]
    )
    return res.rows
  } catch {
    return []
  }
}

/**
 * Persist a birthed discovery card for audit / analytics (table may be absent on older DBs).
 */
export type DiscoveryInjectionMeta = {
  journey_key?: string | null
  question_id?: string | null
  answer_value?: string | null
  is_achievement_card?: boolean
  parent_answer_id?: string | null
  lifestyle_mode?: string | null
}

/** Normalized journey_answers row id after takeover / loop answer persist. */
export async function getJourneyAnswerRowId(
  userId: string,
  journeyKey: string,
  questionKey: string
): Promise<string | null> {
  const pool = getDbPool()
  const uid = userId?.trim()
  const jk = journeyKey?.trim().toLowerCase()
  const qk = questionKey?.trim()
  if (!uid || !jk || !qk) return null
  try {
    const res = await pool.query<{ id: string }>(
      `SELECT id FROM journey_answers
       WHERE user_id = $1::uuid AND journey_key = $2 AND question_key = $3
       LIMIT 1`,
      [uid, jk, qk]
    )
    return res.rows[0]?.id ?? null
  } catch {
    return null
  }
}

export async function persistDiscoveryInjection(
  userId: string,
  cardId: string,
  payload: unknown,
  source?: string | null,
  meta?: DiscoveryInjectionMeta
): Promise<void> {
  const pool = getDbPool()
  const id = String(cardId || 'unknown').slice(0, 256)
  const jk = meta?.journey_key?.trim().toLowerCase().slice(0, 64) ?? null
  const qid = meta?.question_id?.trim().slice(0, 128) ?? null
  const ans = meta?.answer_value?.trim().slice(0, 512) ?? null
  const achievement = meta?.is_achievement_card === true
  const parentAnswerId = meta?.parent_answer_id?.trim() || null
  const lifestyleMode = meta?.lifestyle_mode?.trim().slice(0, 64) || null
  const payloadJson = JSON.stringify(payload ?? {})
  const src = source ? String(source).slice(0, 120) : null
  try {
    await pool.query(
      `INSERT INTO discovery_injections (
         user_id, card_id, payload, source, journey_key, question_id, answer_value,
         is_achievement_card, parent_answer_id, lifestyle_mode
       )
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::uuid, $10)`,
      [userId, id, payloadJson, src, jk, qid, ans, achievement, parentAnswerId, lifestyleMode]
    )
  } catch {
    try {
      await pool.query(
        `INSERT INTO discovery_injections (user_id, card_id, payload, source, journey_key, question_id, answer_value)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)`,
        [userId, id, payloadJson, src, jk, qid, ans]
      )
    } catch {
      try {
        await pool.query(
          `INSERT INTO discovery_injections (user_id, card_id, payload, source)
           VALUES ($1, $2, $3::jsonb, $4)`,
          [userId, id, payloadJson, src]
        )
      } catch {
        /* table missing or constraint */
      }
    }
  }
}

/** Cards birthed per user per `journey_key` (manifest cap: 3 additional injections per category). */
export async function countDiscoveryInjectionsForUserJourney(
  userId: string,
  journeyKey: string
): Promise<number> {
  const pool = getDbPool()
  const jk = String(journeyKey || '').trim().toLowerCase()
  if (!userId || !jk) return 0
  try {
    const res = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM discovery_injections
       WHERE user_id = $1::uuid
         AND LOWER(COALESCE(journey_key, payload->>'journey_key', '')) = $2`,
      [userId, jk]
    )
    const n = Number.parseInt(res.rows[0]?.c ?? '0', 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** Solo Focus final audit — merge completion marker into `users.user_genome` for Hermes / auditors. */
export async function mergeUserGenomeSoloFocusAudit(
  userId: string,
  patch: {
    journeyId?: string | null
    lastQuestionId?: string | null
    lastAnswer?: string | null
  }
): Promise<void> {
  const pool = getDbPool()
  const uid = userId?.trim()
  if (!uid) return

  const payload = {
    solo_focus_audit_complete: {
      at: new Date().toISOString(),
      journey_id: patch.journeyId ?? null,
      last_question_id: patch.lastQuestionId ?? null,
      last_answer: patch.lastAnswer ? String(patch.lastAnswer).slice(0, 500) : null,
    },
  }
  try {
    await pool.query(
      `UPDATE users SET user_genome = COALESCE(user_genome, '{}'::jsonb) || $2::jsonb WHERE id = $1::uuid`,
      [uid, JSON.stringify(payload)]
    )
  } catch {
    /* non-blocking */
  }
}
