export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { analyticsPostBodySchema, invalidBodyResponse, validateFunnelEventType } from '@/lib/api/schemas'
import { buildAnalyticsPayloadRow, parseAnalyticsBody } from '@/lib/analytics/funnelEvents'
import pool from '@/lib/db'
import { captureServerError } from '@/lib/observability/captureError'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'

const ANALYTICS_MAX_PER_MINUTE = 30
const PAYLOAD_MAX_CHARS = 1200

// Analytics endpoint - fire-and-forget; rate-limited and capped to reduce abuse
export async function POST(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`analytics:${id}`, ANALYTICS_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json({ success: false }, { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined })
  }
  try {
    const rawBody = await request.json()
    const validated = analyticsPostBodySchema.safeParse(rawBody)
    if (!validated.success) {
      return invalidBodyResponse(validated.error)
    }
    if (!validateFunnelEventType(validated.data.event_type)) {
      return NextResponse.json({ error: 'Unknown event_type' }, { status: 400 })
    }
    const parsed = parseAnalyticsBody(validated.data)
    const payload = buildAnalyticsPayloadRow(parsed).slice(0, PAYLOAD_MAX_CHARS)
    const { eventType, sessionId, timestamp } = parsed

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
    captureServerError(error, { route: '/api/analytics', method: 'POST' })
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
