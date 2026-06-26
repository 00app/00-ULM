export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { resolveRequestIdentity } from '@/lib/requestAuth'
import {
  finalizeAuthenticatedResponse,
  resolveAuthenticatedUser,
} from '@/lib/auth/resolveAuthenticatedUser'
import { guestIpHashFromRequest } from '@/lib/zone/guestSession'
import { readGuestLikedCardIds, toggleGuestLike } from '@/lib/zone/guestLikes'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'

/** Likes route does not send SMS. */

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const id = getClientIdentifier(request)
    const { ok, retryAfter } = await checkRateLimitAsync(`likes-post:${id}`, 30)
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
      )
    }

    const body = await request.json()
    const bodyObj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const card_id = typeof bodyObj.card_id === 'string' ? bodyObj.card_id.trim() : ''

    if (!card_id || card_id.length > 100) {
      return NextResponse.json(
        { error: 'Missing or invalid card_id' },
        { status: 400 }
      )
    }

    const auth = await resolveAuthenticatedUser(request, bodyObj)
    if (auth?.userId) {
      const user_id = auth.userId
      const existing = await pool.query(
        'SELECT * FROM likes WHERE user_id = $1 AND card_id = $2',
        [user_id, card_id]
      )

      if (existing.rows.length > 0) {
        await pool.query(
          'DELETE FROM likes WHERE user_id = $1 AND card_id = $2',
          [user_id, card_id]
        )
        const res = NextResponse.json({ liked: false })
        return finalizeAuthenticatedResponse(res, auth)
      }

      await pool.query(
        'INSERT INTO likes (user_id, card_id, created_at) VALUES ($1, $2, NOW())',
        [user_id, card_id]
      )
      const res = NextResponse.json({ liked: true })
      return finalizeAuthenticatedResponse(res, auth)
    }

    const identity = await resolveRequestIdentity(request)
    if (!identity || identity.kind !== 'guest') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const liked = await toggleGuestLike(identity.sessionId, card_id, guestIpHashFromRequest(request))
    return NextResponse.json({ liked })
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUser(request, {})
    if (auth?.userId) {
      const result = await pool.query(
        'SELECT card_id FROM likes WHERE user_id = $1',
        [auth.userId]
      )
      const res = NextResponse.json({
        liked_card_ids: result.rows.map((row) => row.card_id),
      })
      return finalizeAuthenticatedResponse(res, auth)
    }

    const identity = await resolveRequestIdentity(request)
    if (!identity || identity.kind !== 'guest') {
      return NextResponse.json({ liked_card_ids: [] })
    }

    const liked_card_ids = await readGuestLikedCardIds(identity.sessionId)
    return NextResponse.json({ liked_card_ids })
  } catch (error) {
    console.error('Error fetching likes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch likes' },
      { status: 500 }
    )
  }
}
