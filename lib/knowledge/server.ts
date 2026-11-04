/**
 * Knowledge gathering — server reads for other agents (Zai, Hermes).
 *
 * Returns the household_facts a person gave us ("told us"), labelled from the fact registry, so an
 * agent can use them without re-asking. Never throws: a missing table or a failed query is simply
 * "nothing known yet".
 */

import { getDbPool } from '@/lib/db'
import { CATEGORY_FACTS } from '@/lib/household/factRegistry'

export type ToldUsFact = { key: string; label: string; value: string; asOf: string }

const LABELS: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>()
  for (const specs of Object.values(CATEGORY_FACTS)) for (const s of specs) if (!m.has(s.key)) m.set(s.key, s.label)
  return m
})()

/** Stored tokens are capitals or ISO dates; show them as plain words / dates. */
function readable(v: unknown): string {
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (s && s === s.toUpperCase()) {
    const lower = s.replace(/_/g, ' ').toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }
  return s
}

export async function loadToldUsFacts(
  owner: { userId?: string | null; guestSessionId?: string | null },
  limit = 20
): Promise<ToldUsFact[]> {
  if (!owner.userId && !owner.guestSessionId) return []
  try {
    const pool = getDbPool()
    const ok = await pool.query(`SELECT to_regclass('public.household_facts') IS NOT NULL AS ok`)
    if (!ok.rows[0]?.ok) return []
    const res = owner.userId
      ? await pool.query(
          `SELECT field_key, value_jsonb, as_of FROM household_facts
            WHERE user_id = $1::uuid AND source_kind = 'told_us' ORDER BY as_of DESC LIMIT $2`,
          [owner.userId, limit]
        )
      : await pool.query(
          `SELECT field_key, value_jsonb, as_of FROM household_facts
            WHERE guest_session_id = $1 AND user_id IS NULL AND source_kind = 'told_us' ORDER BY as_of DESC LIMIT $2`,
          [owner.guestSessionId, limit]
        )
    return res.rows.flatMap((r) => {
      const v = r.value_jsonb && typeof r.value_jsonb === 'object' ? (r.value_jsonb as { value?: unknown }).value : null
      if (v === null || v === undefined || v === '') return []
      const key = String(r.field_key)
      return [{ key, label: LABELS.get(key) ?? key.replace(/_/g, ' '), value: readable(v), asOf: new Date(r.as_of).toISOString() }]
    })
  } catch (err) {
    console.error('[knowledge] loadToldUsFacts failed:', err instanceof Error ? err.message : err)
    return []
  }
}
