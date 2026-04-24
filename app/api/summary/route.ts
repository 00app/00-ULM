import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import type { ImpactProfile } from '@/lib/brains/types'
import { getJourneyAnswersForUser } from '@/lib/db/neon'
import { normalizeEmploymentStatus } from '@/lib/brains/calculations'

// This route is always dynamic (user-specific summary)
export const dynamic = 'force-dynamic'

/** Build profile shape for buildUserImpact from DB user row */
function toImpactProfile(row: Record<string, unknown>): ImpactProfile {
  const ageVal = row.age_group ?? row.age
  const esRaw = row.employment_status
  return {
    name: typeof row.name === 'string' ? row.name : undefined,
    postcode: typeof row.postcode === 'string' ? row.postcode : undefined,
    household: typeof row.household === 'string' ? row.household : undefined,
    home_type: typeof row.home_type === 'string' ? row.home_type : undefined,
    transport_baseline: typeof row.transport_baseline === 'string' ? row.transport_baseline : undefined,
    age: (['JUNIOR', 'MID', 'RETIRED'] as const).includes(ageVal as 'JUNIOR' | 'MID' | 'RETIRED') ? (ageVal as 'JUNIOR' | 'MID' | 'RETIRED') : undefined,
    employment_status: normalizeEmploymentStatus(
      typeof esRaw === 'string' ? esRaw : undefined
    ),
  }
}

// Calculate summary using brain (buildUserImpact): profile + journey answers → true £ and CO₂
async function calculateProfileSummary(
  userId: string,
  profile: ImpactProfile
) {
  const journeyAnswers = await getJourneyAnswersForUser(userId)

  // SINGLE SOURCE OF TRUTH: buildUserImpact (brain) — same as Zone and profile/summary page
  const userImpact = buildUserImpact({
    profile,
    journeyAnswers,
  })

  return {
    savings: userImpact.totals.totalMoney,
    carbon: userImpact.totals.totalCarbon,
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = session.userId

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'profile' or 'journey'

    if (type === 'profile') {
      const userResult = await pool.query(
        'SELECT id, name, postcode, household, home_type, transport_baseline, age_group, employment_status FROM users WHERE id = $1',
        [user_id]
      )

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      const userRow = userResult.rows[0] as Record<string, unknown>
      const profile = toImpactProfile(userRow)
      const summary = await calculateProfileSummary(user_id, profile)

      return NextResponse.json({
        savings: summary.savings,
        carbon: summary.carbon,
        text: `you could save\n£${summary.savings}.\n${summary.carbon}kg co₂e\nthis year alone.`,
      })
    }

    // Journey summary logic would go here
    return NextResponse.json({
      error: 'Journey summaries not yet implemented',
    })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
