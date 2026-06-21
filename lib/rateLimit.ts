/**
 * In-memory rate limit for login attempts.
 * Per-IP and per-email lockout to reduce brute-force risk (OWASP A07).
 * Note: On serverless (e.g. Vercel), each instance has its own map; for strict limits use Redis or similar.
 */
import { checkRateLimitDistributed } from '@/lib/rateLimitDistributed'

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS_PER_IP = 8
const MAX_FAILED_PER_EMAIL = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 min lockout after max failed for an email

interface Entry {
  count: number
  firstAt: number
}

const byIp = new Map<string, Entry>()
const emailFailures = new Map<string, { count: number; lockedUntil: number }>()

function pruneIp(): void {
  const now = Date.now()
  for (const [key, entry] of byIp.entries()) {
    if (now - entry.firstAt > WINDOW_MS) byIp.delete(key)
  }
}

function pruneEmail(): void {
  const now = Date.now()
  for (const [key, entry] of emailFailures.entries()) {
    if (entry.lockedUntil < now) emailFailures.delete(key)
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

/** Client identifier for generic rate limiting (e.g. brain, geocode, local-intel). */
export function getClientIdentifier(request: Request): string {
  return getClientIp(request)
}

/** Generic per-key rate limit: max N requests per minute. In-memory; resets per serverless instance. */
const genericLimits = new Map<string, { count: number; windowStart: number }>()
const GENERIC_WINDOW_MS = 60 * 1000

export function checkRateLimit(
  key: string,
  maxPerMinute: number
): { ok: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = genericLimits.get(key)
  if (!entry) {
    genericLimits.set(key, { count: 1, windowStart: now })
    return { ok: true }
  }
  if (now - entry.windowStart >= GENERIC_WINDOW_MS) {
    entry.count = 1
    entry.windowStart = now
    return { ok: true }
  }
  if (entry.count >= maxPerMinute) {
    const retryAfter = Math.ceil((entry.windowStart + GENERIC_WINDOW_MS - now) / 1000)
    return { ok: false, retryAfter: Math.max(1, retryAfter) }
  }
  entry.count += 1
  return { ok: true }
}

/** Prefer Upstash when configured; otherwise in-memory (per instance). */
export async function checkRateLimitAsync(
  key: string,
  maxPerMinute: number
): Promise<{ ok: boolean; retryAfter?: number }> {
  const distributed = await checkRateLimitDistributed(key, maxPerMinute)
  if (distributed) return distributed
  return checkRateLimit(key, maxPerMinute)
}

/** Returns null if allowed; or an error message if rate limited / locked out. */
export function checkLoginRateLimit(ip: string, email: string): string | null {
  pruneIp()
  pruneEmail()

  const now = Date.now()
  const ipEntry = byIp.get(ip)
  if (ipEntry) {
    if (now - ipEntry.firstAt > WINDOW_MS) {
      byIp.delete(ip)
    } else if (ipEntry.count >= MAX_ATTEMPTS_PER_IP) {
      return 'Too many attempts. Try again in 15 minutes.'
    }
  }

  const emailEntry = emailFailures.get(email.toLowerCase())
  if (emailEntry) {
    if (now < emailEntry.lockedUntil) {
      return 'Too many failed attempts for this account. Try again in 15 minutes.'
    }
    if (now - emailEntry.lockedUntil > LOCKOUT_MS) {
      emailFailures.delete(email.toLowerCase())
    }
  }

  return null
}

export function recordLoginAttempt(ip: string, email: string, success: boolean): void {
  const now = Date.now()
  const key = email.toLowerCase()

  const ipEntry = byIp.get(ip)
  if (ipEntry) {
    if (now - ipEntry.firstAt > WINDOW_MS) {
      byIp.set(ip, { count: 1, firstAt: now })
    } else {
      ipEntry.count += 1
    }
  } else {
    byIp.set(ip, { count: 1, firstAt: now })
  }

  if (success) {
    emailFailures.delete(key)
    return
  }

  const emailEntry = emailFailures.get(key)
  if (!emailEntry) {
    emailFailures.set(key, { count: 1, lockedUntil: 0 })
    return
  }
  emailEntry.count += 1
  if (emailEntry.count >= MAX_FAILED_PER_EMAIL) {
    emailEntry.lockedUntil = now + LOCKOUT_MS
  }
}
