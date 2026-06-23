import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { describeOutboundReadiness } from '@/lib/messaging/outboundGate'
import {
  sendSignupZoneSms,
  type SignupSmsItem,
  type SignupZoneSmsInput,
  normalizeSmsUrl,
} from '@/lib/messaging/signupZoneSms'
import { sendMobileWelcomeSms } from '@/lib/messaging/welcomeSms'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import {
  BOT_GUARD_REJECT,
  honeypotTripped,
  turnstileSecretConfigured,
  verifyTurnstileToken,
} from '@/lib/security/botGuard'

export const dynamic = 'force-dynamic'

/** Per-minute caps (distributed when UPSTASH_REDIS_* is set). */
const MOBILE_SMS_MAX_PER_IP = 3
const MOBILE_SMS_MAX_PER_NUMBER = 2

/** Normalise UK/international mobiles to E.164 (+digits). */
function normalizeMobile(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('0') && digits.length === 11) {
    digits = `44${digits.slice(1)}`
  }
  if (digits.startsWith('44') && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`
  }
  return null
}

function parseStringArray(raw: unknown, max = 6): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max)
  return out.length ? out : undefined
}

function parseSignupItems(raw: unknown, max = 6): SignupSmsItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: SignupSmsItem[] = []
  for (const entry of raw.slice(0, max)) {
    if (typeof entry === 'string') {
      const title = entry.trim()
      if (title) out.push({ title })
      continue
    }
    if (typeof entry !== 'object' || entry === null) continue
    const o = entry as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    if (!title) continue
    const url = typeof o.url === 'string' ? normalizeSmsUrl(o.url) : undefined
    const gbp =
      typeof o.gbp === 'number' && Number.isFinite(o.gbp)
        ? Math.max(0, Math.round(o.gbp))
        : undefined
    out.push({ title, url, gbp })
  }
  return out.length ? out : undefined
}

function mobileLast4(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : '****'
}

function parseSignupPayload(body: unknown): SignupZoneSmsInput & { smsOptIn: boolean } {
  if (typeof body !== 'object' || body === null) return { smsOptIn: false }
  const o = body as Record<string, unknown>
  const tips = parseSignupItems(o.tips)
  const recommendations = parseSignupItems(o.recommendations)
  const smsOptIn = o.sms_opt_in === true || o.smsOptIn === true
  return {
    tipSlugs: parseStringArray(o.tipSlugs, 6),
    tips,
    recommendations: recommendations ?? parseStringArray(o.recommendations, 6),
    userName: typeof o.userName === 'string' ? o.userName.trim() : undefined,
    smsOptIn,
  }
}

/**
 * POST { mobile, sms_opt_in, tips?, recommendations?, userName? } — signed-in users only.
 * SMS sends only when sms_opt_in is true (explicit PECR consent).
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

  if (honeypotTripped(body)) {
    return NextResponse.json({ error: BOT_GUARD_REJECT }, { status: 400 })
  }
  if (turnstileSecretConfigured()) {
    const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const humanOk = await verifyTurnstileToken(o.turnstile_token ?? o.turnstileToken)
    if (!humanOk) {
      return NextResponse.json({ error: BOT_GUARD_REJECT }, { status: 400 })
    }
  }

  const payload = parseSignupPayload(body)
  if (!payload.smsOptIn) {
    return NextResponse.json(
      { error: 'sms opt-in required', sms: { sent: false, reason: 'opt_in_required' } },
      { status: 400 }
    )
  }

  const session = await getSessionFromRequest()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Sign in to save your number and receive SMS' }, { status: 401 })
  }

  const clientId = getClientIdentifier(req)
  const ipLimit = await checkRateLimitAsync(`profile-mobile:ip:${clientId}`, MOBILE_SMS_MAX_PER_IP)
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many SMS requests. Try again later.' },
      {
        status: 429,
        headers: ipLimit.retryAfter ? { 'Retry-After': String(ipLimit.retryAfter) } : undefined,
      }
    )
  }
  const numLimit = await checkRateLimitAsync(
    `profile-mobile:num:${mobile}`,
    MOBILE_SMS_MAX_PER_NUMBER
  )
  if (!numLimit.ok) {
    return NextResponse.json(
      { error: 'Too many messages to this number. Try again later.' },
      {
        status: 429,
        headers: numLimit.retryAfter ? { 'Retry-After': String(numLimit.retryAfter) } : undefined,
      }
    )
  }

  let userName = payload.userName
  let isNewOrChangedMobile = true

  try {
      const row = await pool.query<{
        mobile_sms_opt_in: boolean
        name: string | null
        mobile: string | null
      }>(
        `SELECT mobile_sms_opt_in, name, mobile FROM users WHERE id = $1::uuid`,
        [session.userId]
      )
      if (!userName && row.rows[0]?.name?.trim()) {
        userName = row.rows[0].name!.trim()
      }

      const previousMobile = row.rows[0]?.mobile?.trim() ?? ''
      isNewOrChangedMobile = !previousMobile || previousMobile !== mobile

      await pool.query(
        `UPDATE users SET mobile = $1, mobile_sms_opt_in = $2 WHERE id = $3::uuid`,
        [mobile, payload.smsOptIn, session.userId]
      )
  } catch (e) {
    console.error('[profile/mobile]', e)
    return NextResponse.json({ error: 'could not save' }, { status: 500 })
  }

  const readiness = describeOutboundReadiness()
  if (readiness.status !== 'ready') {
    return NextResponse.json({
      ok: true,
      persisted: true,
      mobile_saved: true,
      mobile_last4: mobileLast4(mobile),
      sms: { sent: false, reason: readiness.reason },
    })
  }

  let welcomeSent = false
  if (isNewOrChangedMobile) {
    const welcome = await sendMobileWelcomeSms(mobile)
    welcomeSent = welcome.ok
    if (!welcome.ok) {
      console.warn('[profile/mobile] welcome SMS failed:', welcome.reason, welcome.detail)
    }
  }

  const sms = await sendSignupZoneSms(mobile, { ...payload, userName })
  return NextResponse.json({
    ok: true,
    persisted: true,
    mobile_saved: true,
    mobile_last4: mobileLast4(mobile),
    welcome: { sent: welcomeSent },
    sms: sms.ok
      ? {
          sent: true,
          sid: sms.sid,
          status: sms.status,
          tipCount: sms.tipCount ?? 0,
          recommendationCount: sms.recommendationCount ?? 0,
        }
      : { sent: false, reason: sms.reason, detail: sms.detail },
  })
}
