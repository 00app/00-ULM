/**
 * Smoke Twilio credentials (no SMS sent).
 * Run: npm run twilio:ping
 */
import { loadEnvLocal } from './load-env-local'
import { describeOutboundReadiness } from '../lib/messaging/outboundGate'
import { pingTwilioAccount } from '../lib/messaging/twilioClient'
import { twilioWebhookUrl } from '../lib/messaging/welcomeSms'

loadEnvLocal({ preferLocal: true })

async function main() {
  const readiness = describeOutboundReadiness()
  console.log('Outbound readiness:', readiness.status === 'ready' ? 'ready' : readiness.reason)

  const ping = await pingTwilioAccount()
  if (!ping.ok) {
    console.error('Twilio ping failed:', ping.error)
    process.exit(1)
  }

  console.log('Account:', ping.accountSid)
  if (ping.friendlyName) console.log('Name:', ping.friendlyName)
  if (ping.status) console.log('Status:', ping.status)
  console.log('Webhook URL (set in Twilio console when number is live):', twilioWebhookUrl())

  if (readiness.status !== 'ready') {
    console.log('\nSMS sends stay off until TWILIO_PHONE_NUMBER is approved and set in env.')
    if (process.env.TWILIO_MESSAGING_ENABLED === '0') {
      console.log('(TWILIO_MESSAGING_ENABLED=0 — remove or set to 1 when ready)')
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
