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

export const dynamic = 'force-dynamic'

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

function parseSignupPayload(body: unknown): SignupZoneSmsInput {
  if (typeof body !== 'object' || body === null) return {}
  const o = body as Record<string, unknown>
  const tips = parseSignupItems(o.tips)
  const recommendations = parseSignupItems(o.recommendations)
  return {
    tipSlugs: parseStringArray(o.tipSlugs, 6),
    tips,
    recommendations: recommendations ?? parseStringArray(o.recommendations, 6),
    userName: typeof o.userName === 'string' ? o.userName.trim() : undefined,
  }
}

/**
 * POST { mobile, tips?, recommendations?, userName? } — save mobile; send Zone signup SMS with URLs.
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

  const payload = parseSignupPayload(body)
  const session = await getSessionFromRequest()
  let userName = payload.userName

  if (session) {
    try {
      const row = await pool.query<{ mobile_sms_opt_in: boolean; name: string | null }>(
        `SELECT mobile_sms_opt_in, name FROM users WHERE id = $1::uuid`,
        [session.userId]
      )
      if (row.rows[0]?.mobile_sms_opt_in === false) {
        return NextResponse.json({
          ok: true,
          persisted: true,
          mobile,
          sms: { sent: false, reason: 'opted_out' },
        })
      }
      if (!userName && row.rows[0]?.name?.trim()) {
        userName = row.rows[0].name!.trim()
      }

      await pool.query(
        `UPDATE users SET mobile = $1, mobile_sms_opt_in = true WHERE id = $2::uuid`,
        [mobile, session.userId]
      )
    } catch (e) {
      console.error('[profile/mobile]', e)
      return NextResponse.json({ error: 'could not save' }, { status: 500 })
    }
  }

  const readiness = describeOutboundReadiness()
  if (readiness.status !== 'ready') {
    return NextResponse.json({
      ok: true,
      persisted: Boolean(session),
      mobile,
      sms: { sent: false, reason: readiness.reason },
    })
  }

  const sms = await sendSignupZoneSms(mobile, { ...payload, userName })
  return NextResponse.json({
    ok: true,
    persisted: Boolean(session),
    mobile,
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
