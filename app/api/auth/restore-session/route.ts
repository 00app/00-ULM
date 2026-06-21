import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, getSessionFromRequest, setSessionCookieOnResponse } from '@/lib/auth'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import {
  allowInsecureDevSessionRestore,
  verifySessionRestoreProof,
  withRestoreProof,
} from '@/lib/sessionRestoreProof'

export const dynamic = 'force-dynamic'

const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PROFILE_ONLY_SESSION_DAYS = 7
const RESTORE_MAX_PER_MINUTE = 12

/** Re-issue `session` cookie when client still has `userId` + HMAC restore proof in storage. */
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
    const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : ''
    const restoreProof =
      typeof body?.restore_proof === 'string' ? body.restore_proof.trim() : ''

    if (!USER_ID_RE.test(userId)) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
    }

    const devBypass = allowInsecureDevSessionRestore()
    if (!devBypass && !verifySessionRestoreProof(userId, restoreProof)) {
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
