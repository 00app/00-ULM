import { getDbPool } from '@/lib/db'

/** Best-effort mirror when `public.user_profiles` exists with `(user_id, journey_answers_jsonb)` (+ PK). */
export async function mirrorJourneyAnswersToUserProfilesIfAvailable(
  userId: string,
  journeyAnswers: Record<string, Record<string, string>>
): Promise<boolean> {
  const uid = userId?.trim()
  if (!uid) return false
  const pool = getDbPool()
  try {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_profiles'`
    )
    const set = new Set(r.rows.map((x) => x.column_name))
    if (!set.has('user_id') || !set.has('journey_answers_jsonb')) return false

    await pool.query(
      `INSERT INTO user_profiles (user_id, journey_answers_jsonb, updated_at)
       VALUES ($1::uuid, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         journey_answers_jsonb = EXCLUDED.journey_answers_jsonb,
         updated_at = NOW()`,
      [uid, JSON.stringify(journeyAnswers)]
    )
    return true
  } catch {
    return false
  }
}
