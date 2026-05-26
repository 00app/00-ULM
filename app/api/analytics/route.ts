export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

const ANALYTICS_MAX_PER_MINUTE = 30
const PAYLOAD_MAX_CHARS = 1000

// Analytics endpoint - fire-and-forget; rate-limited and capped to reduce abuse
export async function POST(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = checkRateLimit(`analytics:${id}`, ANALYTICS_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json({ success: false }, { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined })
  }
  try {
    const body = await request.json()
    const eventType = typeof body?.event_type === 'string' ? body.event_type.slice(0, 80) : 'unknown'
    const sessionId = typeof body?.session_id === 'string' ? body.session_id.slice(0, 120) : null
    const timestamp = typeof body?.timestamp === 'string' ? body.timestamp.slice(0, 48) : new Date().toISOString()
    const payloadObj =
      body && typeof body === 'object'
        ? {
            event_type: eventType,
            session_id: sessionId,
            timestamp,
            ...(typeof body?.page === 'string' && { page: body.page.slice(0, 200) }),
            ...(typeof body?.referrer === 'string' && { referrer: body.referrer.slice(0, 200) }),
          }
        : { event_type: eventType, session_id: sessionId, timestamp }
    const payload = JSON.stringify(payloadObj).slice(0, PAYLOAD_MAX_CHARS)

    await pool.query(
      `INSERT INTO analytics_events (
        event_type, session_id, timestamp, payload
      ) VALUES ($1, $2, $3, $4)`,
      [eventType, sessionId, timestamp, payload]
    ).catch(() => {
      // Silently fail - analytics never blocks
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Silently fail - analytics never blocks
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
