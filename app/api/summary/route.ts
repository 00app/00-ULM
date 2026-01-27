import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import { type JourneyId } from '@/lib/journeys'

// This route is always dynamic (user-specific summary)
export const dynamic = 'force-dynamic'

// Calculate summary using locked calculation engine
// Profile data is used for context only - calculations come from journey answers
async function calculateProfileSummary(userId: string) {
  // Get all journey answers for this user
  const answersResult = await pool.query(
    `SELECT journey_key, question_id, answer 
     FROM journey_answers 
     WHERE user_id = $1`,
    [userId]
  )

  // Organize answers by journey
  const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
    JourneyId,
    Record<string, string>
  >
  
  answersResult.rows.forEach((row: any) => {
    const journeyKey = row.journey_key as JourneyId
    if (!journeyAnswers[journeyKey]) {
      journeyAnswers[journeyKey] = {}
    }
    journeyAnswers[journeyKey][row.question_id] = row.answer
  })

  // SINGLE SOURCE OF TRUTH: Use buildUserImpact for all calculations
  const userImpact = buildUserImpact({
    journeyAnswers,
  })

  return {
    savings: userImpact.totals.totalMoney,
    carbon: userImpact.totals.totalCarbon,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const type = searchParams.get('type') // 'profile' or 'journey'

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id' },
        { status: 400 }
      )
    }

    if (type === 'profile') {
      // Get user profile
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [user_id]
      )

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      const summary = await calculateProfileSummary(user_id)

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
