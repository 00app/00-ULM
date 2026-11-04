export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Knowledge gathering — answers to Solo Focus, loop and agent questions, kept server-side.
 *
 * POST records one ask: an answer fills household_facts (told us, tier 2) and logs a
 *      knowledge_questions row; a skip / "not sure" logs the row with a 30-day snooze.
 * GET  returns the latest answer per question and the questions still snoozed, so a new device
 *      (or the same person after clearing storage) picks up where they left off.
 *
 * Works for signed-in users and guests (same owner pattern as offer_signals). Tables come from
 * db/migrations/20261025_intelligence_layer.sql + 20261104_knowledge_gathering.sql; where they are
 * missing the route answers 200 with nothing stored, so the client keeps working from its cache.
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { resolveRequestIdentity, type RequestIdentity } from '@/lib/requestAuth'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import {
  KNOWLEDGE_SNOOZE_DAYS,
  KNOWLEDGE_SOURCES,
  factCategoryForQuestion,
  factKeyForQuestion,
  isJourneyId,
  isKnownQuestion,
  type KnowledgeSource,
} from '@/lib/knowledge/questions'

let tablesReady: boolean | null = null
async function knowledgeTablesExist(): Promise<boolean> {
  if (tablesReady !== null) return tablesReady
  try {
    const r = await pool.query(
      `SELECT to_regclass('public.household_facts') IS NOT NULL
          AND to_regclass('public.knowledge_questions') IS NOT NULL AS ok`
    )
    tablesReady = Boolean(r.rows[0]?.ok)
  } catch {
    tablesReady = false
  }
  return tablesReady
}

const owner = (id: RequestIdentity) =>
  id.kind === 'user' ? { userId: id.userId, guestId: null } : { userId: null, guestId: id.sessionId }

export async function POST(request: NextRequest) {
  try {
    const client = getClientIdentifier(request)
    const { ok, retryAfter } = await checkRateLimitAsync(`knowledge-post:${client}`, 60)
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
      )
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const questionId = typeof body?.question_id === 'string' ? body.question_id.trim() : ''
    const journeyId = body?.journey_id
    const status = body?.status === 'skipped' ? 'skipped' : body?.status === 'answered' ? 'answered' : null
    const rawAnswer = typeof body?.answer === 'string' ? body.answer.trim() : ''
    const source: KnowledgeSource = KNOWLEDGE_SOURCES.includes(body?.source as KnowledgeSource)
      ? (body?.source as KnowledgeSource)
      : 'solo_focus'

    if (!isKnownQuestion(questionId) || !isJourneyId(journeyId) || !status) {
      return NextResponse.json({ error: 'Unknown question, journey or status' }, { status: 400 })
    }
    if (status === 'answered' && (!rawAnswer || rawAnswer.length > 120)) {
      return NextResponse.json({ error: 'Answer missing or too long' }, { status: 400 })
    }

    const identity = await resolveRequestIdentity(request)
    if (!identity) return NextResponse.json({ error: 'No session' }, { status: 401 })
    if (!(await knowledgeTablesExist())) return NextResponse.json({ stored: false })

    const { userId, guestId } = owner(identity)
    const fieldKey = factKeyForQuestion(questionId)

    if (status === 'answered' && fieldKey) {
      const category = factCategoryForQuestion(questionId, journeyId)
      const value = JSON.stringify({ value: rawAnswer })
      const params = [userId, guestId, category, fieldKey, value]
      // Partial unique indexes: one fact per owner and field. The newest answer wins.
      const conflict = userId
        ? `ON CONFLICT (user_id, field_key) WHERE user_id IS NOT NULL`
        : `ON CONFLICT (guest_session_id, field_key) WHERE user_id IS NULL AND guest_session_id IS NOT NULL`
      await pool.query(
        `INSERT INTO household_facts
           (user_id, guest_session_id, category, field_key, value_jsonb, source_kind, source_name,
            as_of, confidence, confidence_reason, tier)
         VALUES ($1::uuid, $2, $3, $4, $5::jsonb, 'told_us', 'You told us', NOW(), 'high',
                 'You told us this.', 2)
         ${conflict}
         DO UPDATE SET category = EXCLUDED.category, value_jsonb = EXCLUDED.value_jsonb,
                       as_of = NOW(), updated_at = NOW(), source_kind = 'told_us',
                       source_name = 'You told us', confidence = 'high', tier = 2`,
        params
      )
    }

    await pool.query(
      `INSERT INTO knowledge_questions
         (user_id, guest_session_id, question_id, field_key, journey_id, status, answer_value,
          source, shown_at, resolved_at, snooze_until)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(),
               CASE WHEN $6 = 'skipped' THEN NOW() + ($9 || ' days')::interval ELSE NULL END)`,
      [
        userId,
        guestId,
        questionId,
        fieldKey,
        journeyId,
        status,
        status === 'answered' ? rawAnswer : null,
        source,
        String(KNOWLEDGE_SNOOZE_DAYS),
      ]
    )

    return NextResponse.json({ stored: true, field_key: fieldKey })
  } catch (error) {
    console.error('[knowledge] POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to store answer' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveRequestIdentity(request)
    if (!identity || !(await knowledgeTablesExist())) {
      return NextResponse.json({ answers: [], snoozed: [] })
    }
    const { userId, guestId } = owner(identity)
    const where = userId ? 'user_id = $1::uuid' : 'guest_session_id = $1 AND user_id IS NULL'
    // Latest row per question decides: answered → replay the answer; skipped and still snoozed → rest it.
    const r = await pool.query(
      `SELECT DISTINCT ON (question_id)
              question_id, journey_id, status, answer_value, resolved_at, snooze_until
         FROM knowledge_questions
        WHERE ${where}
        ORDER BY question_id, resolved_at DESC NULLS LAST, shown_at DESC`,
      [userId ?? guestId]
    )
    const answers: { question_id: string; journey_id: string | null; answer: string; at: string }[] = []
    const snoozed: { question_id: string; until: string }[] = []
    const now = Date.now()
    for (const row of r.rows as Record<string, unknown>[]) {
      const qid = String(row.question_id)
      if (row.status === 'answered' && typeof row.answer_value === 'string') {
        answers.push({
          question_id: qid,
          journey_id: typeof row.journey_id === 'string' ? row.journey_id : null,
          answer: row.answer_value,
          at: new Date(row.resolved_at as string).toISOString(),
        })
      } else if (row.status === 'skipped' && row.snooze_until && new Date(row.snooze_until as string).getTime() > now) {
        snoozed.push({ question_id: qid, until: new Date(row.snooze_until as string).toISOString() })
      }
    }
    return NextResponse.json({ answers, snoozed })
  } catch (error) {
    console.error('[knowledge] GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ answers: [], snoozed: [] })
  }
}
