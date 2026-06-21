export type TwilioConfig = {
  accountSid: string
  authToken: string
  fromNumber: string | null
}

export function readTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? ''
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? ''
  if (!accountSid.startsWith('AC') || !authToken) return null

  const rawFrom = process.env.TWILIO_PHONE_NUMBER?.trim() ?? ''
  const fromNumber = rawFrom ? normalizeE164(rawFrom) : null

  return { accountSid, authToken, fromNumber }
}

/** UK/international → E.164 (+digits). */
export function normalizeE164(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null
  }
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0') && digits.length === 11) {
    digits = `44${digits.slice(1)}`
  }
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`
  return null
}
