import pool from '@/lib/db'

/** Lazy-init Neon guest row for server-issued `zz_sid` (audit: server session cookie). */
export async function ensureGuestSessionRow(
  sessionId: string,
  ipHash: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO guest_sessions (session_id, ip_hash, profile, journey_answers, completed_journeys, updated_at)
     VALUES ($1, $2, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, NOW())
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, ipHash]
  )
}
