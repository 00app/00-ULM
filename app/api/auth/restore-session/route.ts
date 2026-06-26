import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, getSessionFromRequest, setSessionCookieOnResponse } from '@/lib/auth'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import {
  resolveUserIdFromRestoreProof,
  withRestoreProof,
} from '@/lib/sessionRestoreProof'

export const dynamic = 'force-dynamic'

const PROFILE_ONLY_SESSION_DAYS = 7
const RESTORE_MAX_PER_MINUTE = 6

/** Re-issue `session` cookie when client holds a valid HMAC restore proof (sessionStorage). */
export async function POST(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`restore-session:${id}`, RESTORE_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    )
  }

  const existing = await getSessionFromRequest().catch(() => null)
  if (existing?.userId) {
    return NextResponse.json(
      withRestoreProof({ ok: true, user_id: existing.userId, restored: false }, existing.userId)
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const restoreProof =
      typeof body?.restore_proof === 'string' ? body.restore_proof.trim() : ''

    const userId = resolveUserIdFromRestoreProof(restoreProof)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired restore proof' }, { status: 403 })
    }

    const found = await pool.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [userId])
    if (!found.rows?.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const token = await createSession(userId, PROFILE_ONLY_SESSION_DAYS)
    const res = NextResponse.json(
      withRestoreProof({ ok: true, user_id: userId, restored: true }, userId)
    )
    setSessionCookieOnResponse(res, token, PROFILE_ONLY_SESSION_DAYS * 24 * 60 * 60)
    return res
  } catch (error) {
    console.error('[auth/restore-session]', error)
    return NextResponse.json({ error: 'Failed to restore session' }, { status: 500 })
  }
}
