/**
 * Ensure Gary demo user + profile mirror exist (Neon handshake for BN17 research rows).
 */
import pool from '@/lib/db'
import { GARY_RESEARCH_USER_ID } from '@/lib/zone/garyMode'

export async function ensureGaryDemoUser(postcode = 'BN177DW'): Promise<void> {
  const pc = postcode.replace(/\s+/g, '').trim().toUpperCase()
  try {
    await pool.query(
      `INSERT INTO users (id, name, email, postcode, household, home_type, transport_baseline, user_genome)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, '{}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         postcode = EXCLUDED.postcode,
         household = COALESCE(EXCLUDED.household, users.household),
         home_type = COALESCE(EXCLUDED.home_type, users.home_type),
         transport_baseline = COALESCE(EXCLUDED.transport_baseline, users.transport_baseline)`,
      [GARY_RESEARCH_USER_ID, 'Gary Demo', 'gary@00.app', pc, 'FAMILY', 'HOUSE', 'CAR']
    )
  } catch {
    await pool.query(
      `INSERT INTO users (id, name, postcode, household, home_type, transport_baseline)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         postcode = EXCLUDED.postcode`,
      [GARY_RESEARCH_USER_ID, 'Gary Demo', pc, 'FAMILY', 'HOUSE', 'CAR']
    )
  }
  await pool.query(
    `INSERT INTO user_profiles (user_id, journey_answers_jsonb)
     VALUES ($1::uuid, '{}'::jsonb)
     ON CONFLICT (user_id) DO NOTHING`,
    [GARY_RESEARCH_USER_ID]
  )
}

export async function relinkOrphanResearchToGary(): Promise<number> {
  const r = await pool.query(
    `UPDATE research_results
     SET user_id = $1::uuid
     WHERE user_id IS NULL
     RETURNING id`,
    [GARY_RESEARCH_USER_ID]
  )
  return r.rowCount ?? 0
}
