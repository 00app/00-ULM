/**
 * Zai chat transcript persistence — `zai_messages` table, keyed by signed-in user id or
 * guest session id (whichever identity the request carries). Lets the /zai page restore
 * the conversation after a reload instead of starting blank every time.
 */
import { getDbPool } from '@/lib/db'

export type ZaiMessageRole = 'user' | 'zai'

export async function appendZaiMessages(
  sessionId: string | null | undefined,
  turns: { role: ZaiMessageRole; content: string }[]
): Promise<void> {
  const id = sessionId?.trim()
  const rows = turns.filter((t) => t.content.trim().length > 0)
  if (!id || rows.length === 0) return
  try {
    const pool = getDbPool()
    const values: string[] = []
    const params: unknown[] = [id]
    rows.forEach((row, i) => {
      values.push(`($1, $${i * 2 + 2}, $${i * 2 + 3})`)
      params.push(row.role, row.content)
    })
    await pool.query(
      `INSERT INTO zai_messages (session_id, role, content) VALUES ${values.join(', ')}`,
      params
    )
  } catch (err) {
    console.error('[zai_messages] append failed:', err instanceof Error ? err.message : err)
  }
}

export async function getRecentZaiMessages(
  sessionId: string | null | undefined,
  limit = 40
): Promise<{ role: ZaiMessageRole; content: string; created_at: string }[]> {
  const id = sessionId?.trim()
  if (!id) return []
  try {
    const pool = getDbPool()
    const res = await pool.query(
      `SELECT role, content, created_at FROM zai_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [id, limit]
    )
    return res.rows as { role: ZaiMessageRole; content: string; created_at: string }[]
  } catch (err) {
    console.error('[zai_messages] read failed:', err instanceof Error ? err.message : err)
    return []
  }
}
