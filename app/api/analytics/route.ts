import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// Analytics endpoint - fire-and-forget, never blocks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Store analytics event (non-blocking)
    // In production, you might use a queue or separate service
    await pool.query(
      `INSERT INTO analytics_events (
        event_type, session_id, timestamp, payload
      ) VALUES ($1, $2, $3, $4)`,
      [
        body.event_type,
        body.session_id,
        body.timestamp,
        JSON.stringify(body),
      ]
    ).catch(() => {
      // Silently fail - analytics never blocks
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Silently fail - analytics never blocks
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
