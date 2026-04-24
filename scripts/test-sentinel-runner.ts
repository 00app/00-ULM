import { randomUUID } from 'node:crypto'
import { getDbPool } from '@/lib/db'
import {
  advanceHomeJourneySentinelAfterAnswer,
  APRIL_2026_ENERGY_CAP_GBP,
  HOME_CHILD_QUESTION,
  SCOTTISH_HES_URL,
  WICK_GRANT_GBP,
  primaryHomeSlide,
  syncUserZone,
} from '@/lib/sentinel/runner'
import { getDraughtProofingSoftSave, getFlowTempSoftSave } from '@/lib/sentinel/scraper'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const pool = getDbPool()
  const userId = randomUUID()
  const postcode = 'KW11AA'
  const renterUserId = randomUUID()
  const englandOwnerId = randomUUID()
  const expectedDelta = WICK_GRANT_GBP - APRIL_2026_ENERGY_CAP_GBP

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
    assert(result.homeState.slides.length === 3, 'Expected three-slide Wick homeowner deck')
    assert(
      p0.mother.saveGbp === expectedDelta,
      `Expected home delta ${expectedDelta}, got ${p0.mother.saveGbp}`
    )
    assert(
      p0.child.question === HOME_CHILD_QUESTION,
      `Expected child question "${HOME_CHILD_QUESTION}", got "${p0.child.question}"`
    )
    assert(
      p0.mother.ctaUrl === SCOTTISH_HES_URL,
      `Expected Scottish CTA URL "${SCOTTISH_HES_URL}", got "${p0.mother.ctaUrl}"`
    )
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
    assert(!eng.postcode.startsWith('KW'), 'England control should not use KW grid lock')
    assert(eng.homeState.slides.length === 3, 'England owner should get BUS + two behavioural slides')
    assert(
      eng.homeState.slides[0]?.mother.saveGbp === 7500,
      'First slide should be April 2026 BUS £7,500 structural pathway'
    )

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
    assert(r0.mother.category === 'behavioral', 'Expected renter logic to suppress structural grants')
    assert(renter.homeState.slides.length === 3, 'Expected three-slide Wick renter behavioral deck')
    assert(
      r0.child.question === flow.childQuestion,
      'Expected first renter slide to be Nesta flow-temperature pathway'
    )
    const draught = getDraughtProofingSoftSave()
    assert(
      renter.homeState.slides[1]?.child.question === draught.childQuestion,
      'Expected P2 renter slide to be EST draught-proofing soft save'
    )
    assert(
      renter.homeState.slides[0]?.mother.saveGbp === 105,
      'Occupancy 3 → £70 × 1.5 behavioural scale'
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
