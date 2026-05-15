import { getDbPool } from '@/lib/db'

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
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_profiles'`
    )
    const set = new Set(r.rows.map((x) => x.column_name))
    if (!set.has('user_id') || !set.has('journey_answers_jsonb')) return false

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
