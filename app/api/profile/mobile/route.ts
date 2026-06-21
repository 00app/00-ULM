import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { describeOutboundReadiness } from '@/lib/messaging/outboundGate'
import { sendMobileWelcomeSms } from '@/lib/messaging/welcomeSms'

export const dynamic = 'force-dynamic'

/** Normalise UK/international mobiles to E.164 (+digits). */
function normalizeMobile(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  // UK local: 07… (11 digits) → +447…
  if (digits.startsWith('0') && digits.length === 11) {
    digits = `44${digits.slice(1)}`
  }
  // Already 44… without +
  if (digits.startsWith('44') && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`
  }
  // Generic international: 10–15 digits
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`
  }
  return null
}

/**
 * POST { mobile } — save SMS-ready number on the signed-in user row (Neon).
 * Guests: returns ok without DB write; client keeps `zz_profile_mobile` in localStorage.
 * Welcome SMS fires when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER are set.
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

  const readiness = describeOutboundReadiness()
  if (readiness.status !== 'ready') {
    return NextResponse.json({
      ok: true,
      persisted: true,
      mobile,
      sms: { sent: false, reason: readiness.reason },
    })
  }

  const sms = await sendMobileWelcomeSms(mobile)
  return NextResponse.json({
    ok: true,
    persisted: true,
    mobile,
    sms: sms.ok
      ? { sent: true, sid: sms.sid, status: sms.status }
      : { sent: false, reason: sms.reason, detail: sms.detail },
  })
}
