/**
 * 13-domain DB evolution: ensure `journey_questions` exists and mirror `lib/journeys.ts`
 * (13 categories × 3 loop questions). Uses parameterized queries — no inline commas in SQL.
 *
 *   npm run db:evolve-13-domains
 *
 * Does not wipe `research_results`. Do not use ad-hoc `zone_questions` one-liners;
 * the app reads `journey_questions` + in-code `JOURNEYS`.
 */
import fs from 'fs'
import path from 'path'
import { JOURNEY_ORDER, JOURNEYS, type JourneyId } from '../lib/journeys'
import { loadEnvLocal } from './load-env-local'

async function main() {
  loadEnvLocal({ preferLocal: true })

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('❌ DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }

  console.log('🛠 Starting DB Evolution (13 domains)...')

  const migrationPath = path.join(
    process.cwd(),
    'db/migrations/017_research_genome_journey_questions.sql'
  )
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Missing', migrationPath)
    process.exit(1)
  }

  const { withNeonPool } = await import('./neon-wake')
  const migrationSql = fs.readFileSync(migrationPath, 'utf8')

  await withNeonPool(async (query) => {
    const pool = (await import('../lib/db')).getDbPool()

    await query(migrationSql)
    console.log('✅ Applied journey_questions migration (017).')

    await pool.query('BEGIN')
    try {
      await pool.query(`DELETE FROM journey_questions WHERE journey_key = ANY($1::text[])`, [
        [...JOURNEY_ORDER],
      ])

      let inserted = 0
      for (const journeyId of JOURNEY_ORDER as readonly JourneyId[]) {
        const def = JOURNEYS[journeyId]
        for (let sort = 0; sort < def.questions.length; sort++) {
          const q = def.questions[sort]!
          const config: Record<string, unknown> = { type: q.type }
          if (q.options?.length) config.options = q.options
          if (q.repeatLabel) config.repeatLabel = q.repeatLabel

          await pool.query(
            `INSERT INTO journey_questions (journey_key, question_key, prompt_text, sort_order, config)
             VALUES ($1, $2, $3, $4, $5::jsonb)`,
            [journeyId, q.id, q.label, sort, JSON.stringify(config)]
          )
          inserted++
        }
      }

      await pool.query('COMMIT')
      console.log(`✅ Seeded ${inserted} journey_questions (${JOURNEY_ORDER.length} domains).`)
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }

    const count = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM journey_questions WHERE journey_key = ANY($1::text[])`,
      [[...JOURNEY_ORDER]]
    )
    console.log('   Row count (13-domain keys):', count.rows[0]?.n ?? '0')
    console.log('✅ NEON ARMED: 13-DOMAIN DATA CAPTURE ACTIVE')
  })
}

main().catch((e: unknown) => {
  console.error('❌ Error:', e instanceof Error ? e.message : e)
  process.exit(1)
})
