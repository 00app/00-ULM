import twilio from 'twilio'
import { describeOutboundReadiness } from '@/lib/messaging/outboundGate'
import { normalizeE164 } from '@/lib/messaging/twilioConfig'

export type SendSmsResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; reason: 'not_configured' | 'invalid_to' | 'send_failed'; detail?: string }

export async function sendTwilioSms(toRaw: string, body: string): Promise<SendSmsResult> {
  const readiness = describeOutboundReadiness()
  if (readiness.status !== 'ready') {
    return { ok: false, reason: 'not_configured', detail: readiness.reason }
  }

  const to = normalizeE164(toRaw)
  if (!to) return { ok: false, reason: 'invalid_to' }

  const text = body.trim()
  if (!text) return { ok: false, reason: 'send_failed', detail: 'empty body' }

  try {
    const client = twilio(readiness.config.accountSid, readiness.config.authToken)
    const message = await client.messages.create({
      to,
      from: readiness.config.fromNumber,
      body: text,
    })
    return { ok: true, sid: message.sid, status: message.status ?? 'queued' }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error'
    console.error('[twilio/send]', detail)
    return { ok: false, reason: 'send_failed', detail }
  }
}

/** Credential smoke — does not send SMS or require TWILIO_PHONE_NUMBER. */
export async function pingTwilioAccount(): Promise<{
  ok: boolean
  accountSid?: string
  friendlyName?: string
  status?: string
  error?: string
}> {
  const readiness = describeOutboundReadiness()
  const cfg =
    readiness.status === 'ready'
      ? readiness.config
      : (() => {
          const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? ''
          const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? ''
          if (!accountSid.startsWith('AC') || !authToken) return null
          return { accountSid, authToken, fromNumber: process.env.TWILIO_PHONE_NUMBER?.trim() ?? null }
        })()

  if (!cfg) return { ok: false, error: 'missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' }

  try {
    const client = twilio(cfg.accountSid, cfg.authToken)
    const account = await client.api.accounts(cfg.accountSid).fetch()
    return {
      ok: true,
      accountSid: account.sid,
      friendlyName: account.friendlyName ?? undefined,
      status: account.status ?? undefined,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'fetch failed' }
  }
}

export function validateTwilioWebhook(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature) return false
  return twilio.validateRequest(authToken, signature, url, params)
}
