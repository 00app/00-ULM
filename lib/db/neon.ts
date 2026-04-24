/**
 * Neon PostgreSQL — journey answers (JSONB only).
 * Reads and writes `journey_answers_jsonb` to avoid normalized-table drift.
 */

import { getDbPool } from '@/lib/db'
import { isValidJourneyQuestion } from '@/lib/journeys'
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

/**
 * Latest stored unit rates + canonical source link for a postcode (or global fallback).
 */
export async function getLatestResearchUnitRates(
  postcode: string | null | undefined
): Promise<ResearchUnitRatesRow | null> {
  const pool = getDbPool()
  const pc = postcode?.replace(/\s+/g, '').trim() || ''
  try {
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
 * Latest `research_results` row for citation footer (prefers matching postcode).
 */
export async function getLatestResearchCitation(
  postcode: string | null | undefined
): Promise<ResearchSourceCitation | null> {
  const pool = getDbPool()
  const pc = postcode?.replace(/\s+/g, '').trim() || ''
  try {
    if (pc.length >= 4) {
      const r1 = await pool.query<{
        citations: unknown
        markdown: string | null
        source_url: string | null
        created_at: Date | string | null
      }>(
        `SELECT citations, markdown, source_url, created_at FROM research_results
         WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [pc]
      )
      const cite = firstCitationFromRow(r1.rows[0])
      if (cite) return cite
    }
    const r2 = await pool.query<{
      citations: unknown
      markdown: string | null
      source_url: string | null
      created_at: Date | string | null
    }>(
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
 * Latest headline + Supplied-by for Solo Focus / Zone (prefers matching postcode).
 */
export async function getLatestResearchAttribution(
  postcode: string | null | undefined
): Promise<ResearchAttribution | null> {
  const pool = getDbPool()
  const pc = postcode?.replace(/\s+/g, '').trim() || ''
  type Row = { agent_headline: string | null; provider_name: string | null }
  const map = (row: Row | undefined): ResearchAttribution | null => {
    if (!row) return null
    const headline = row.agent_headline?.trim() || null
    const supplied_by = row.provider_name?.trim() || null
    if (!headline && !supplied_by) return null
    return { headline, supplied_by }
  }
  try {
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
 * Persist NextWin (or similar) gateway invoke snapshot for morph + diagnostics.
 */
export async function insertResearchInvokeSnapshot(params: {
  postcode?: string | null
  profileSnapshot?: Record<string, unknown> | null
  markdown: string
  citations: unknown
  sourceUrl?: string | null
  providerName?: string | null
  agentHeadline?: string | null
  invokePayload: unknown
}): Promise<void> {
  const pool = getDbPool()
  try {
    await pool.query(
      `INSERT INTO research_results (
         postcode, profile_snapshot, markdown, citations,
         elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url,
         provider_name, agent_headline, openclaw_raw_json, created_at
       )
       VALUES (
         $1, $2::jsonb, $3, $4::jsonb,
         NULL, NULL, $5,
         $6, $7, $8::jsonb, NOW()
       )`,
      [
        params.postcode ?? null,
        JSON.stringify(params.profileSnapshot ?? {}),
        params.markdown,
        JSON.stringify(Array.isArray(params.citations) ? params.citations : []),
        params.sourceUrl ?? null,
        params.providerName?.trim() ?? null,
        params.agentHeadline?.trim() ?? null,
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
  if (!isValidJourneyQuestion(journeyId, answerKey)) return
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
export async function persistDiscoveryInjection(
  userId: string,
  cardId: string,
  payload: unknown,
  source?: string | null
): Promise<void> {
  const pool = getDbPool()
  const id = String(cardId || 'unknown').slice(0, 256)
  try {
    await pool.query(
      `INSERT INTO discovery_injections (user_id, card_id, payload, source)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [userId, id, JSON.stringify(payload ?? {}), source ? String(source).slice(0, 120) : null]
    )
  } catch {
    /* table missing or constraint */
  }
}
