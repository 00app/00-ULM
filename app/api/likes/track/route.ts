import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { pinZaiSuggestionLink } from '@/lib/brains/zai/learning'

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
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!url || url.length > 2048) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    let hostname = 'link'
    try {
      hostname = new URL(url).hostname.replace(/^www\./i, '')
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    const card_id = `suggest_${Buffer.from(url).toString('base64url').slice(0, 48)}`
    const title =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : `Act on ${hostname}`

    await pool.query(
      `INSERT INTO likes (user_id, card_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, card_id) DO NOTHING`,
      [session.userId, card_id]
    )

    const journey_key =
      typeof body?.journey_key === 'string' ? body.journey_key.trim().slice(0, 64) : undefined
    await pinZaiSuggestionLink({
      userId: session.userId,
      url,
      title,
      journeyKey: journey_key,
    })

    return NextResponse.json({ ok: true, card_id, title, pinned: true })
  } catch (error) {
    console.error('[likes/track]', error)
    return NextResponse.json({ error: 'Failed to track suggestion' }, { status: 500 })
  }
}
