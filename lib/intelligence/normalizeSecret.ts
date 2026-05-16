/**
 * Normalize secrets from Vercel env pull / CLI (trim, strip accidental literal `\n` suffix).
 */
export function normalizeSecret(value: string | null | undefined): string {
  let s = (value ?? '').trim()
  if (s.endsWith('\\n')) s = s.slice(0, -2)
  if (s.endsWith('\\r')) s = s.slice(0, -2)
  return s.trim()
}

export function secretMeetsMinLength(value: string | null | undefined, min = 16): boolean {
  return normalizeSecret(value).length >= min
}
