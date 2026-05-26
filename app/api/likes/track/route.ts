import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { pinZaiSuggestionLink } from '@/lib/brains/zai/learning'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Record a suggested action from chat / expanded links (suggestions rail).
 * Uses card_id = hash of URL so repeat clicks upsert the same row.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const trackType = typeof body?.type === 'string' ? body.type.trim() : 'suggestion'
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    const explicitCardId =
      typeof body?.card_id === 'string' && body.card_id.trim()
        ? body.card_id.trim().slice(0, 256)
        : ''

    if (!explicitCardId && (!url || url.length > 2048)) {
      return NextResponse.json({ error: 'Invalid url or card_id' }, { status: 400 })
    }

    let hostname = 'link'
    if (url.startsWith('http')) {
      try {
        hostname = new URL(url).hostname.replace(/^www\./i, '')
      } catch {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
      }
    }

    const card_id =
      explicitCardId || `suggest_${Buffer.from(url).toString('base64url').slice(0, 48)}`
    const title =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : trackType === 'visited'
          ? 'Visited audit'
          : `Act on ${hostname}`

    await pool.query(
      `INSERT INTO likes (user_id, card_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, card_id) DO NOTHING`,
      [session.userId, card_id]
    )

    const journey_key =
      typeof body?.journey_key === 'string' ? body.journey_key.trim().slice(0, 64) : undefined

    if (trackType === 'visited') {
      const category = journey_key?.replace(/^journey-/, '') || journey_key
      try {
        await pool.query(
          `UPDATE research_results
           SET last_visited_at = NOW()
           WHERE id = (
             SELECT id FROM research_results
             WHERE user_id = $1
               AND (
                 ($2::text IS NOT NULL AND category = $2)
                 OR ($3::text <> '' AND offer_url = $3)
               )
             ORDER BY created_at DESC NULLS LAST
             LIMIT 1
           )`,
          [session.userId, category || null, url.startsWith('http') ? url : '']
        )
      } catch {
        /* column may not exist until migration applied */
      }
    }

    if (trackType !== 'visited' && url.startsWith('http')) {
      await pinZaiSuggestionLink({
        userId: session.userId,
        url,
        title,
        journeyKey: journey_key,
      })
    }

    return NextResponse.json({
      ok: true,
      card_id,
      title,
      pinned: trackType !== 'visited',
      visited: trackType === 'visited',
    })
  } catch (error) {
    console.error('[likes/track]', error)
    return NextResponse.json({ error: 'Failed to track suggestion' }, { status: 500 })
  }
}
