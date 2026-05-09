import { randomUUID } from 'node:crypto'
import { getDbPool } from '@/lib/db'
import {
  advanceHomeJourneySentinelAfterAnswer,
  HOME_CHILD_QUESTION,
  primaryHomeSlide,
  syncUserZone,
} from '@/lib/sentinel/runner'
import { getFlowTempSoftSave, getPhantomStandbySoftSave } from '@/lib/sentinel/scraper'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const pool = getDbPool()
  const userId = randomUUID()
  const postcode = 'KW11AA'
  const renterUserId = randomUUID()
  const englandOwnerId = randomUUID()

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS postcode TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb`).catch(() => {})

  await pool.query(
    `INSERT INTO users (id, postcode, user_genome)
     VALUES ($1, $2, $3::jsonb)`,
    [
      userId,
      postcode,
      JSON.stringify({
        home: { heating_source: 'gas' },
        goals: ['SAVE'],
      }),
    ]
  )
  await pool.query(
    `INSERT INTO users (id, postcode, user_genome)
     VALUES ($1, $2, $3::jsonb)`,
    [
      renterUserId,
      postcode,
      JSON.stringify({
        household: { occupancy_count: 3, tenure_type: 'rent' },
        travel: { transit_mode: 'public' },
        home: { heating_type: 'gas' },
      }),
    ]
  )
  await pool.query(
    `INSERT INTO users (id, postcode, user_genome)
     VALUES ($1, $2, $3::jsonb)`,
    [
      englandOwnerId,
      'SW1A1AA',
      JSON.stringify({
        household: { tenure_type: 'own', occupancy_count: 2 },
        home: { heating_type: 'gas' },
      }),
    ]
  )

  try {
    const result = await syncUserZone({
      userId,
      location: postcode,
      genome: { home: { ownership: 'owner' } },
      appOrigin: process.env.APP_ORIGIN || 'http://127.0.0.1:3000',
    })

    assert(result.postcode.startsWith('KW'), 'Expected KW postcode context')
    const p0 = primaryHomeSlide(result.homeState)
    assert(result.homeState.slides.length === 3, 'Expected three-slide behavioural deck')
    assert(
      p0.mother.saveGbp >= 0,
      `Expected baseline audit save non-negative, got ${p0.mother.saveGbp}`
    )
    assert(
      p0.child.question === HOME_CHILD_QUESTION,
      `Expected child question "${HOME_CHILD_QUESTION}", got "${p0.child.question}"`
    )
    assert(typeof p0.mother.ctaUrl === 'string' && p0.mother.ctaUrl.startsWith('http'), 'Expected CTA URL')
    const flow = getFlowTempSoftSave()
    assert(
      result.homeState.slides[1]?.child.question === flow.childQuestion,
      'Expected P2 Mother deck to use Nesta flow-temperature child question'
    )
    assert(
      result.homeState.slides[1]?.mother.saveGbp === 88,
      'Expected occupancy×1.25 Nesta £70 pathway → £88 for default occupancy 2'
    )

    const step1 = await advanceHomeJourneySentinelAfterAnswer(pool, userId)
    assert(step1 != null, 'advanceHomeJourneySentinelAfterAnswer should return a recard payload')
    assert(step1.sessionAnswerCount === 1, 'First home answer should increment Sentinel session count')
    assert(step1.slideCursor === 1, 'First answer should advance Mother deck to slide index 1')

    const eng = await syncUserZone({
      userId: englandOwnerId,
      location: 'SW1A1AA',
      genome: {},
      appOrigin: process.env.APP_ORIGIN || 'http://127.0.0.1:3000',
    })
    assert(!eng.postcode.startsWith('KW'), 'England control should not use KW tier')
    assert(eng.homeState.slides.length === 3, 'England owner should get three behavioural slides')

    const renter = await syncUserZone({
      userId: renterUserId,
      location: postcode,
      genome: {
        household: { occupancy_count: 3, tenure_type: 'rent' },
        travel: { transit_mode: 'public' },
        home: { heating_type: 'gas' },
      },
      appOrigin: process.env.APP_ORIGIN || 'http://127.0.0.1:3000',
    })
    const r0 = primaryHomeSlide(renter.homeState)
    assert(r0.mother.category === 'behavioral', 'Expected renter logic to keep behavioural category')
    assert(renter.homeState.slides.length === 3, 'Expected three-slide KW renter behavioural deck')
    assert(
      r0.child.question === HOME_CHILD_QUESTION,
      'Expected first renter slide to be baseline heating question'
    )
    const standby = getPhantomStandbySoftSave()
    assert(
      renter.homeState.slides[1]?.child.question === standby.childQuestion,
      'Expected P2 renter slide to be EST phantom-load soft save'
    )
    const renterBaselineSave = renter.homeState.slides[0]?.mother.saveGbp ?? 0
    assert(
      renterBaselineSave >= 100 && renterBaselineSave <= 2000,
      `Expected renter baseline capped saving band, got ${renterBaselineSave}`
    )

    console.log('[sentinel-runner] PASS')
    console.log(
      JSON.stringify(
        {
          postcode: result.postcode,
          saveDeltaGbp: p0.mother.saveGbp,
          childQuestion: p0.child.question,
          ctaUrl: p0.mother.ctaUrl,
          renterCategory: r0.mother.category,
          renterQuestion: r0.child.question,
        },
        null,
        2
      )
    )
  } finally {
    await pool.query('DELETE FROM journey_state WHERE user_id = $1', [userId]).catch(() => {})
    await pool.query('DELETE FROM journey_state WHERE user_id = $1', [renterUserId]).catch(() => {})
    await pool.query('DELETE FROM journey_state WHERE user_id = $1', [englandOwnerId]).catch(() => {})
    await pool.query('DELETE FROM journeys WHERE user_id = $1', [userId]).catch(() => {})
    await pool.query('DELETE FROM journeys WHERE user_id = $1', [renterUserId]).catch(() => {})
    await pool.query('DELETE FROM journeys WHERE user_id = $1', [englandOwnerId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [renterUserId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [englandOwnerId]).catch(() => {})
  }
}

main().catch((error) => {
  console.error('[sentinel-runner] FAIL', error)
  process.exitCode = 1
})
