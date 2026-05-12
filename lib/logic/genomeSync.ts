/**
 * Server-only: Neon genome fields for API routes / Server Actions.
 * Do not import from Client Components — pulls `pg` (Node `dns`).
 */

import { getDbPool } from '@/lib/db'

export interface GenomeSyncProfile {
  age?: string
  tenure?: string
  home_type?: string
  household_size?: number
}

/**
 * Profile genome handshake from Neon (users + user_genome jsonb).
 */
export async function getGenomeSyncProfileFromNeon(userId: string): Promise<GenomeSyncProfile | null> {
  if (!userId?.trim()) return null
  const pool = getDbPool()
  try {
    const row = await pool
      .query<{
        age_group?: string | null
        home_type?: string | null
        household?: string | null
        user_genome?: Record<string, unknown> | null
      }>(
        `SELECT age_group, home_type, household, user_genome
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId.trim()]
      )
      .then((r) => r.rows[0])
    if (!row) return null
    const genome = (row.user_genome ?? {}) as Record<string, unknown>
    const householdFromText = Number.parseInt(String(row.household ?? '').replace(/[^\d]/g, ''), 10)
    const sizeFromGenome = Number(genome.household_size ?? genome.householdSize)
    const household_size = Number.isFinite(sizeFromGenome)
      ? Math.max(1, Math.round(sizeFromGenome))
      : Number.isFinite(householdFromText)
        ? Math.max(1, householdFromText)
        : undefined
    const tenureRaw = genome.tenure ?? genome.tenure_type ?? genome.housing_tenure
    return {
      age: typeof row.age_group === 'string' ? row.age_group : undefined,
      tenure: typeof tenureRaw === 'string' ? tenureRaw : undefined,
      home_type:
        typeof genome.home_type === 'string'
          ? genome.home_type
          : typeof row.home_type === 'string'
            ? row.home_type
            : undefined,
      household_size,
    }
  } catch {
    return null
  }
}
