import pool from '@/lib/db'
import { ensureGuestSessionRow } from '@/lib/zone/ensureGuestSessionRow'

function parseLikedIds(profile: unknown): string[] {
  if (!profile || typeof profile !== 'object') return []
  const raw = (profile as { liked_card_ids?: unknown }).liked_card_ids
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100)
}

export async function readGuestLikedCardIds(sessionId: string): Promise<string[]> {
  const res = await pool.query(`SELECT profile FROM guest_sessions WHERE session_id = $1`, [sessionId])
  if (!res.rows?.length) return []
  return parseLikedIds(res.rows[0].profile)
}

export async function toggleGuestLike(
  sessionId: string,
  cardId: string,
  ipHash: string | null = null
): Promise<boolean> {
  await ensureGuestSessionRow(sessionId, ipHash)
  const current = await readGuestLikedCardIds(sessionId)
  const liked = current.includes(cardId)
  const next = liked ? current.filter((id) => id !== cardId) : [...current, cardId]
  await pool.query(
    `UPDATE guest_sessions
     SET profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object('liked_card_ids', $2::jsonb),
         updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId, JSON.stringify(next)]
  )
  return !liked
}
