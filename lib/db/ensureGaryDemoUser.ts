/**
 * Legacy Gary demo user repair — scripts only (not used in app hot path).
 */
import { LEGACY_DEMO_USER_ID } from '@/lib/zone/garyMode'

export async function ensureGaryDemoUser(postcode = 'BN177DW'): Promise<void> {
  const pool = (await import('@/lib/db')).default
  const pc = postcode.replace(/\s+/g, '').trim().toUpperCase()
  try {
    await pool.query(
      `INSERT INTO users (id, name, email, postcode, household, home_type, transport_baseline)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET postcode = EXCLUDED.postcode, updated_at = NOW()`,
      [LEGACY_DEMO_USER_ID, 'Gary Demo', 'gary@00.app', pc, 'FAMILY', 'HOUSE', 'CAR']
    )
  } catch {
    await pool.query(
      `INSERT INTO users (id, name, postcode, household, home_type, transport_baseline)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET postcode = EXCLUDED.postcode`,
      [LEGACY_DEMO_USER_ID, 'Gary Demo', pc, 'FAMILY', 'HOUSE', 'CAR']
    )
  }
  await pool.query(
    `INSERT INTO user_profiles (user_id, display_name, postcode, household, home_type, transport_baseline)
     VALUES ($1::uuid, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET postcode = EXCLUDED.postcode`,
    [LEGACY_DEMO_USER_ID, 'Gary Demo', pc, 'FAMILY', 'HOUSE', 'CAR']
  )
}

export async function relinkOrphanResearchToGary(): Promise<number> {
  const pool = (await import('@/lib/db')).default
  const result = await pool.query(
    `UPDATE research_results SET user_id = $1::uuid WHERE user_id IS NULL AND REPLACE(COALESCE(postcode, ''), ' ', '') LIKE 'BN17%'`,
    [LEGACY_DEMO_USER_ID]
  )
  return result.rowCount ?? 0
}
