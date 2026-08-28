import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { describeOutboundReadiness } from '@/lib/messaging/outboundGate'
import {
  finalizeAuthenticatedResponse,
  resolveAuthenticatedUser,
} from '@/lib/auth/resolveAuthenticatedUser'
import {
  sendSignupZoneSms,
  type SignupSmsItem,
  type SignupZoneSmsInput,
  normalizeSmsUrl,
} from '@/lib/messaging/signupZoneSms'
import { sendMobileWelcomeSms } from '@/lib/messaging/welcomeSms'
import { normalizeMobileE164 } from '@/lib/messaging/ukMobile'
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
/**
 * Becoming "authenticated" here costs nothing (profile-only accounts need no password), so the
 * per-minute caps above only slow a script down, they don't stop it running for hours. This is a
 * second, independent cap on the same key across a full day: without it, someone could drip-feed
 * real Twilio SMS to an arbitrary number indefinitely (harassment, plus unbounded spend), just by
 * staying under 2 requests/minute forever. 6/day covers a real user changing their mind about
 * their own number a few times, not a sustained send.
 */
const MOBILE_SMS_MAX_PER_NUMBER_PER_DAY = 6
const DAY_SEC = 24 * 60 * 60

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
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const bodyObj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const raw =
    typeof body === 'object' && body !== null && typeof (body as { mobile?: unknown }).mobile === 'string'
      ? (body as { mobile: string }).mobile
      : ''
  const mobile = normalizeMobileE164(raw)
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

  const auth = await resolveAuthenticatedUser(req, bodyObj)
  if (!auth?.userId) {
    return NextResponse.json({ error: 'Sign in to save your number and receive SMS' }, { status: 401 })
  }
  const session = { userId: auth.userId }

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
  const numDailyLimit = await checkRateLimitAsync(
    `profile-mobile:num:day:${mobile}`,
    MOBILE_SMS_MAX_PER_NUMBER_PER_DAY,
    DAY_SEC
  )
  if (!numDailyLimit.ok) {
    return NextResponse.json(
      { error: 'Too many messages to this number today. Try again tomorrow.' },
      {
        status: 429,
        headers: numDailyLimit.retryAfter
          ? { 'Retry-After': String(numDailyLimit.retryAfter) }
          : undefined,
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

      if (isNewOrChangedMobile) {
        // Becoming "authenticated" costs nothing (a fresh profile-only session, no password),
        // so without this check anyone could claim a stranger's real number here, then win the
        // tie-break in /api/auth/login-mobile's `ORDER BY created_at DESC` and silently lock the
        // real owner out of mobile login — a cheap denial-of-service/impersonation, not just a
        // data-quality issue. Reject outright rather than letting a second account hold the same
        // number, mirroring the uniqueness email already gets (idx_users_email).
        const claimed = await pool.query(
          `SELECT 1 FROM users WHERE mobile = $1 AND id != $2::uuid LIMIT 1`,
          [mobile, session.userId]
        )
        if (claimed.rows.length > 0) {
          return NextResponse.json(
            { error: 'This number is already saved on another account' },
            { status: 409 }
          )
        }
      }

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
    const res = NextResponse.json({
      ok: true,
      persisted: true,
      mobile_saved: true,
      mobile_last4: mobileLast4(mobile),
      sms: { sent: false, reason: readiness.reason },
    })
    if (auth.attachSession) {
      return finalizeAuthenticatedResponse(res, auth)
    }
    return res
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
  const res = NextResponse.json({
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
  if (auth.attachSession) {
    return finalizeAuthenticatedResponse(res, auth)
  }
  return res
}
