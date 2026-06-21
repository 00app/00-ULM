import { readTwilioConfig, type TwilioConfig } from '@/lib/messaging/twilioConfig'

/**
 * Outbound SMS is opt-in via env — never hard-coded off.
 * Requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER.
 * Set TWILIO_MESSAGING_ENABLED=0 to kill sends while keeping credentials loaded.
 */
export function getTwilioConfig(): TwilioConfig | null {
  return readTwilioConfig()
}

export function isTwilioOutboundReady(): boolean {
  const cfg = readTwilioConfig()
  if (!cfg?.fromNumber) return false
  if (process.env.TWILIO_MESSAGING_ENABLED === '0') return false
  return true
}

export type OutboundReadiness =
  | { status: 'disabled'; reason: 'missing_credentials' | 'missing_from_number' | 'messaging_disabled' }
  | { status: 'ready'; config: TwilioConfig & { fromNumber: string } }

export function describeOutboundReadiness(): OutboundReadiness {
  const cfg = readTwilioConfig()
  if (!cfg) return { status: 'disabled', reason: 'missing_credentials' }
  if (process.env.TWILIO_MESSAGING_ENABLED === '0') {
    return { status: 'disabled', reason: 'messaging_disabled' }
  }
  if (!cfg.fromNumber) return { status: 'disabled', reason: 'missing_from_number' }
  return { status: 'ready', config: { ...cfg, fromNumber: cfg.fromNumber } }
}
