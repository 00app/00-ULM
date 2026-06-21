import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { readTwilioConfig } from '@/lib/messaging/twilioConfig'
import { validateTwilioWebhook } from '@/lib/messaging/twilioClient'
import { sendMobileStartSms, sendMobileStopSms, twilioWebhookUrl } from '@/lib/messaging/welcomeSms'
import { normalizeE164 } from '@/lib/messaging/twilioConfig'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function formParams(form: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  form.forEach((value, key) => {
    if (typeof value === 'string') out[key] = value
  })
  return out
}

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Twilio inbound SMS + delivery status.
 * Console: Phone number → Messaging → "A message comes in" → POST {twilioWebhookUrl}
 */
export async function POST(req: NextRequest) {
  const cfg = readTwilioConfig()
  if (!cfg) {
    return NextResponse.json({ error: 'twilio not configured' }, { status: 503 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'expected form body' }, { status: 400 })
  }

  const params = formParams(form)
  const signature = req.headers.get('x-twilio-signature')
  const url = twilioWebhookUrl()

  if (process.env.NODE_ENV === 'production') {
    const valid = validateTwilioWebhook(cfg.authToken, signature, url, params)
    if (!valid) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
    }
  }

  const from = params.From?.trim() ?? ''
  const body = (params.Body ?? '').trim().toUpperCase()
  const fromE164 = from ? normalizeE164(from) : null

  async function setOptIn(optIn: boolean) {
    if (!fromE164) return
    try {
      await pool.query(`UPDATE users SET mobile_sms_opt_in = $1 WHERE mobile = $2`, [optIn, fromE164])
    } catch (e) {
      console.error('[twilio/webhook] opt-in update', e)
    }
  }

  if (body === 'STOP' || body === 'UNSUBSCRIBE' || body === 'CANCEL') {
    if (from) void sendMobileStopSms(from)
    void setOptIn(false)
    return twiml()
  }

  if (body === 'START' || body === 'UNSTOP') {
    if (from) void sendMobileStartSms(from)
    void setOptIn(true)
    return twiml()
  }

  // Status callback fields — log only; no TwiML reply needed.
  if (params.MessageStatus) {
    console.info('[twilio/webhook] status', {
      sid: params.MessageSid,
      status: params.MessageStatus,
      to: params.To,
    })
    return twiml()
  }

  return twiml()
}
