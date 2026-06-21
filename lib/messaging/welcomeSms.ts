import { CANONICAL_SITE_URL, getSiteUrl } from '@/lib/site'
import { sendTwilioSms } from '@/lib/messaging/twilioClient'

const WELCOME_BODY =
  'zero zero — you are on the list for tips and local offer drops. reply STOP to opt out.'

const STOP_BODY = 'zero zero — you are unsubscribed. reply START to opt back in.'

const START_BODY = 'zero zero — you are back on the list for tips and offer drops.'

export async function sendMobileWelcomeSms(to: string) {
  return sendTwilioSms(to, WELCOME_BODY)
}

export async function sendMobileStopSms(to: string) {
  return sendTwilioSms(to, STOP_BODY)
}

export async function sendMobileStartSms(to: string) {
  return sendTwilioSms(to, START_BODY)
}

/** Resolve public origin for Twilio callbacks (must match console + signature validation). */
export function twilioWebhookBaseUrl(): string {
  const full = process.env.TWILIO_WEBHOOK_URL?.trim().replace(/\/$/, '')
  if (full) return full.replace(/\/api\/webhooks\/twilio$/i, '')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (appUrl) return appUrl

  if (process.env.VERCEL_ENV === 'production') return CANONICAL_SITE_URL

  return getSiteUrl()
}

/** Public webhook URL for Twilio console (Messaging → inbound / status). */
export function twilioWebhookUrl(): string {
  const full = process.env.TWILIO_WEBHOOK_URL?.trim().replace(/\/$/, '')
  if (full) return full
  return `${twilioWebhookBaseUrl()}/api/webhooks/twilio`
}
