/**
 * UK postcode format validation — client + server guard before geocode.
 * Outcode fallback (e.g. SW12) when parish name is not yet resolved.
 */

const UK_POSTCODE_FULL_RE =
  /^([Gg][Ii][Rr]\s?0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9]?[A-Za-z]))))\s?[0-9][A-Za-z]{2})$/

export function compactUkPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').toUpperCase()
}

/** True when compact or spaced input matches a full UK postcode. */
export function isValidUkPostcode(postcode: string): boolean {
  const raw = postcode.trim()
  if (!raw) return false
  const compact = compactUkPostcode(raw)
  if (compact.length < 5 || compact.length > 8) return false
  const spaced =
    compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact
  return UK_POSTCODE_FULL_RE.test(spaced) || UK_POSTCODE_FULL_RE.test(compact)
}

/** Outward code while typing or when locality is not ready — e.g. SW12 from SW128AA. */
export function formatPostcodeOutcodeFallback(postcode: string): string {
  const compact = compactUkPostcode(postcode)
  if (!compact) return ''
  if (compact.length >= 5) {
    return compact.slice(0, -3)
  }
  return compact.slice(0, Math.min(4, compact.length))
}

export type UkPostcodeCheck = {
  valid: boolean
  normalized: string
  outcode: string
}

export function checkUkPostcode(postcode: string): UkPostcodeCheck {
  const compact = compactUkPostcode(postcode)
  const outcode = formatPostcodeOutcodeFallback(postcode)
  const normalized =
    compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}`.trim() : compact
  return {
    valid: isValidUkPostcode(compact),
    normalized,
    outcode,
  }
}
