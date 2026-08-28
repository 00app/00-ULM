/** UK mobile — domestic 07… / 7… only (+44 optional, not required). */
export function isValidUkMobileInput(input: string): boolean {
  let digits = input.trim().replace(/\D/g, '')
  if (!digits) return false

  if (digits.startsWith('44') && digits.length === 12) {
    digits = `0${digits.slice(2)}`
  }

  return /^07\d{9}$/.test(digits) || /^7\d{9}$/.test(digits)
}

/**
 * Normalise UK/international mobiles to E.164 (+digits) — the exact form stored in `users.mobile`
 * (see app/api/profile/mobile/route.ts) and so the only form login-by-mobile can match against.
 */
export function normalizeMobileE164(input: string): string | null {
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
