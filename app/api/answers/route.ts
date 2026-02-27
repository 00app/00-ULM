import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = session.userId

    const body = await request.json()
    const {
      journey_id,
      journey_key,
      question_id,
      question_key,
      answer,
      answer_value,
    } = body

    const jKey = journey_key ?? journey_id
    const qKey = question_key ?? question_id
    const value = answer_value ?? answer

    if (!jKey || !qKey || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: journey_key (or journey_id), question_key (or question_id), answer (or answer_value)' },
        { status: 400 }
      )
    }

    await pool.query(
      `INSERT INTO journey_answers (user_id, journey_key, question_key, answer, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, journey_key, question_key)
       DO UPDATE SET answer = $4, updated_at = NOW()`,
      [user_id, jKey, qKey, String(value)]
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
