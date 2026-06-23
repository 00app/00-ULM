/**
 * Lightweight bot resistance — honeypot + optional Cloudflare Turnstile.
 * Turnstile is enforced only when TURNSTILE_SECRET_KEY is set (production).
 */

const HONEYPOT_KEYS = ['company_fax', 'website_url', 'fax_number'] as const

export function turnstileSiteKey(): string | null {
  const k = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  return k && k.length > 4 ? k : null
}

export function turnstileSecretConfigured(): boolean {
  const k = process.env.TURNSTILE_SECRET_KEY?.trim()
  return Boolean(k && k.length > 8)
}

/** Hidden field bots often fill — reject without revealing the trap. */
export function honeypotTripped(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const o = body as Record<string, unknown>
  for (const key of HONEYPOT_KEYS) {
    const v = o[key]
    if (typeof v === 'string' && v.trim().length > 0) return true
  }
  return false
}

export async function verifyTurnstileToken(token: unknown): Promise<boolean> {
  if (!turnstileSecretConfigured()) return true
  const t = typeof token === 'string' ? token.trim() : ''
  if (!t) return false
  const secret = process.env.TURNSTILE_SECRET_KEY!.trim()
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: t }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

/** Shared rejection for bots — generic copy, no trap hints. */
export const BOT_GUARD_REJECT = 'could not verify — try again'
