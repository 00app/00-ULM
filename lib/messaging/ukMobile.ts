/** UK mobile — domestic 07… / 7… only (+44 optional, not required). */
export function isValidUkMobileInput(input: string): boolean {
  let digits = input.trim().replace(/\D/g, '')
  if (!digits) return false

  if (digits.startsWith('44') && digits.length === 12) {
    digits = `0${digits.slice(2)}`
  }

  return /^07\d{9}$/.test(digits) || /^7\d{9}$/.test(digits)
}
