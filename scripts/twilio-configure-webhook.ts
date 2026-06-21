/**
 * Point the Twilio FROM number at /api/webhooks/twilio (inbound STOP/START + status).
 * Run after TWILIO_PHONE_NUMBER is approved and set in Vercel / .env.local:
 *   npm run twilio:configure-webhook
 */
import twilio from 'twilio'
import { loadEnvLocal } from './load-env-local'
import { readTwilioConfig, normalizeE164 } from '../lib/messaging/twilioConfig'
import { twilioWebhookUrl } from '../lib/messaging/welcomeSms'

loadEnvLocal({ preferLocal: true })

async function main() {
  const cfg = readTwilioConfig()
  if (!cfg?.fromNumber) {
    console.error('Set TWILIO_PHONE_NUMBER (+447…) in .env.local or Vercel, then re-run.')
    process.exit(1)
  }

  const webhook = twilioWebhookUrl()
  const client = twilio(cfg.accountSid, cfg.authToken)
  const from = cfg.fromNumber

  const listed = await client.incomingPhoneNumbers.list({ phoneNumber: from, limit: 5 })
  const match = listed.find((row) => normalizeE164(row.phoneNumber ?? '') === from)

  if (!match) {
    console.error(`No incoming number found for ${from}. Buy/assign the number in Twilio first.`)
    process.exit(1)
  }

  const updated = await client.incomingPhoneNumbers(match.sid).update({
    smsUrl: webhook,
    smsMethod: 'POST',
    statusCallback: webhook,
    statusCallbackMethod: 'POST',
  })

  console.log('Configured:', updated.phoneNumber)
  console.log('SMS URL:', updated.smsUrl)
  console.log('Status callback:', updated.statusCallback)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
