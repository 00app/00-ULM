/**
 * DB-backed journey question bank (optional). Always filter by `journey_key` — never query without it,
 * so Home and Tech (and other categories) never leak across.
 */
import { getDbPool } from '@/lib/db'

export interface JourneyQuestionRow {
  id: string
  journey_key: string
  question_key: string
  prompt_text: string | null
  sort_order: number
  config: Record<string, unknown>
}

export async function listJourneyQuestionsForJourneyKey(journeyKey: string): Promise<JourneyQuestionRow[]> {
  const pool = getDbPool()
  const key = String(journeyKey || '').trim()
  if (!key) return []
  try {
    const r = await pool.query<{
      id: string
      journey_key: string
      question_key: string
      prompt_text: string | null
      sort_order: number
      config: unknown
    }>(
      `SELECT id, journey_key, question_key, prompt_text, sort_order, config
       FROM journey_questions
       WHERE journey_key = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [key]
    )
    return r.rows.map((row) => ({
      id: row.id,
      journey_key: row.journey_key,
      question_key: row.question_key,
      prompt_text: row.prompt_text,
      sort_order: row.sort_order,
      config:
        row.config && typeof row.config === 'object' && !Array.isArray(row.config)
          ? (row.config as Record<string, unknown>)
          : {},
    }))
  } catch {
    return []
  }
}
