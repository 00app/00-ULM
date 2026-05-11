import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Normalise to +digits (E.164-style). Strips non-digits; 10–15 digits acceptable for international mobiles. */
function normalizeMobile(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (digitsOnly.length < 10 || digitsOnly.length > 15) return null
  return `+${digitsOnly}`
}

/**
 * POST { mobile } — save WhatsApp/Telegram-ready number on the signed-in user row (Neon).
 * Guests: returns ok without DB write; client keeps `zz_profile_mobile` in localStorage.
 * Outbound Hermes/Telegram dispatch is intentionally not wired here — add a worker or webhook later.
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const raw =
    typeof body === 'object' && body !== null && typeof (body as { mobile?: unknown }).mobile === 'string'
      ? (body as { mobile: string }).mobile
      : ''
  const mobile = normalizeMobile(raw)
  if (!mobile) {
    return NextResponse.json({ error: 'invalid mobile number' }, { status: 400 })
  }

  const session = await getSessionFromRequest()
  if (!session) {
    return NextResponse.json({ ok: true, persisted: false, mobile })
  }

  try {
    await pool.query(`UPDATE users SET mobile = $1 WHERE id = $2::uuid`, [mobile, session.userId])
  } catch (e) {
    console.error('[profile/mobile]', e)
    return NextResponse.json({ error: 'could not save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, persisted: true, mobile })
}
