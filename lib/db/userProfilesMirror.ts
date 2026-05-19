import { getDbPool } from '@/lib/db'
import { mapProfileGoalToPrimaryGoal } from '@/lib/zone/affluenceCheck'

export type UlmGenomeMirror = {
  employment_status?: string | null
  household_income_bracket?: string | null
  /** SQL values: save | reduce | both — or pass profile_goal (money/carbon/balanced) via `goal`. */
  primary_goal?: string | null
  /** Client profile_goal — mapped to primary_goal when column exists. */
  goal?: string | null
}

async function userProfilesColumnSet(): Promise<Set<string> | null> {
  const pool = getDbPool()
  try {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_profiles'`
    )
    const set = new Set(r.rows.map((x) => x.column_name))
    if (!set.has('user_id') || !set.has('journey_answers_jsonb')) return null
    return set
  } catch {
    return null
  }
}

/** Persist Ulm genome columns on `user_profiles` (employment, income bracket, primary_goal). */
export async function mirrorUlmGenomeToUserProfiles(
  userId: string,
  fields: UlmGenomeMirror
): Promise<boolean> {
  const uid = userId?.trim()
  if (!uid) return false
  const cols = await userProfilesColumnSet()
  if (!cols) return false

  const primaryGoalRaw =
    fields.primary_goal?.trim() ||
    (fields.goal?.trim() ? mapProfileGoalToPrimaryGoal(fields.goal) : null)
  const assignments: string[] = []
  const values: unknown[] = [uid]
  let idx = 2

  if (cols.has('employment_status') && fields.employment_status?.trim()) {
    assignments.push(`employment_status = $${idx++}`)
    values.push(fields.employment_status.trim().slice(0, 50))
  }
  if (cols.has('household_income_bracket') && fields.household_income_bracket?.trim()) {
    assignments.push(`household_income_bracket = $${idx++}`)
    values.push(fields.household_income_bracket.trim().slice(0, 50))
  }
  if (cols.has('primary_goal') && primaryGoalRaw) {
    assignments.push(`primary_goal = $${idx++}`)
    values.push(primaryGoalRaw.slice(0, 20))
  }
  if (!assignments.length) return false

  const pool = getDbPool()
  try {
    const upd = await pool.query(
      `UPDATE user_profiles
       SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE user_id = $1::uuid`,
      values
    )
    if ((upd.rowCount ?? 0) > 0) return true

    await pool.query(
      `INSERT INTO user_profiles (user_id, journey_answers_jsonb, updated_at)
       VALUES ($1::uuid, '{}'::jsonb, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [uid]
    )
    const retry = await pool.query(
      `UPDATE user_profiles
       SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE user_id = $1::uuid`,
      values
    )
    return (retry.rowCount ?? 0) > 0
  } catch {
    return false
  }
}

/**
 * UPSERT journey snapshot into `user_profiles` when the table matches the Solo Focus mirror shape.
 * Tries `ON CONFLICT (user_id)` first; falls back to UPDATE → INSERT for older deployments.
 */
export async function mirrorJourneyAnswersToUserProfilesIfAvailable(
  userId: string,
  journeyAnswers: Record<string, Record<string, string>>
): Promise<boolean> {
  const uid = userId?.trim()
  if (!uid) return false
  const pool = getDbPool()
  const ja = JSON.stringify(journeyAnswers)

  try {
    const set = await userProfilesColumnSet()
    if (!set) return false

    try {
      await pool.query(
        `INSERT INTO user_profiles (user_id, journey_answers_jsonb, updated_at)
         VALUES ($1::uuid, $2::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           journey_answers_jsonb = EXCLUDED.journey_answers_jsonb,
           updated_at = EXCLUDED.updated_at`,
        [uid, ja]
      )
      return true
    } catch {
      const upd = await pool.query(
        `UPDATE user_profiles
         SET journey_answers_jsonb = $2::jsonb,
             updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [uid, ja]
      )
      if ((upd.rowCount ?? 0) > 0) return true

      try {
        const ins = await pool.query(
          `INSERT INTO user_profiles (user_id, journey_answers_jsonb, updated_at)
           VALUES ($1::uuid, $2::jsonb, NOW())`,
          [uid, ja]
        )
        return (ins.rowCount ?? 0) > 0
      } catch {
        const retry = await pool.query(
          `UPDATE user_profiles
           SET journey_answers_jsonb = $2::jsonb,
               updated_at = NOW()
           WHERE user_id = $1::uuid`,
          [uid, ja]
        )
        return (retry.rowCount ?? 0) > 0
      }
    }
  } catch {
    return false
  }
}
