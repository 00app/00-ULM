import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, journey_id, question_id, answer } = body

    if (!user_id || !journey_id || !question_id || answer === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await pool.query(
      `INSERT INTO journey_answers (user_id, journey_id, question_id, answer, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, journey_id, question_id)
       DO UPDATE SET answer = $4, updated_at = NOW()`,
      [user_id, journey_id, question_id, answer]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving answer:', error)
    return NextResponse.json(
      { error: 'Failed to save answer' },
      { status: 500 }
    )
  }
}
