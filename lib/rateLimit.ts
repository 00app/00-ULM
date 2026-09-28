/**
 * Rate limit for login attempts.
 * Per-IP (distributed, see checkLoginRateLimit below) and per-email lockout (in-memory) to
 * reduce brute-force risk (OWASP A07).
 */
import { checkRateLimitDistributed } from '@/lib/rateLimitDistributed'
import { checkRateLimitNeon } from '@/lib/rateLimitNeon'

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS_PER_IP = 8
const MAX_FAILED_PER_EMAIL = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 min lockout after max failed for an email

const emailFailures = new Map<string, { count: number; lockedUntil: number }>()

function pruneEmail(): void {
  const now = Date.now()
  for (const [key, entry] of emailFailures.entries()) {
    if (entry.lockedUntil < now) emailFailures.delete(key)
  }
}

/**
 * Vercel's edge appends the true connecting IP as the LAST hop in x-forwarded-for;
 * earlier hops are client-supplied and can be spoofed to rotate past rate limits.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded.split(',').map((ip) => ip.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }
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
  maxPerWindow: number,
  windowMs: number = GENERIC_WINDOW_MS
): { ok: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = genericLimits.get(key)
  if (!entry) {
    genericLimits.set(key, { count: 1, windowStart: now })
    return { ok: true }
  }
  if (now - entry.windowStart >= windowMs) {
    entry.count = 1
    entry.windowStart = now
    return { ok: true }
  }
  if (entry.count >= maxPerWindow) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000)
    return { ok: false, retryAfter: Math.max(1, retryAfter) }
  }
  entry.count += 1
  return { ok: true }
}

/** Prefer Upstash when configured (rare — most deployments don't set it), else the Neon-backed
 *  table (durable, shared across instances, no extra vendor since DATABASE_URL is already
 *  required), else in-memory (per-instance, last resort). */
export async function checkRateLimitAsync(
  key: string,
  maxPerWindow: number,
  windowSec = 60
): Promise<{ ok: boolean; retryAfter?: number }> {
  const upstash = await checkRateLimitDistributed(key, maxPerWindow, windowSec)
  if (upstash) return upstash
  const neon = await checkRateLimitNeon(key, maxPerWindow, windowSec)
  if (neon) return neon
  return checkRateLimit(key, maxPerWindow, windowSec * 1000)
}

/**
 * Returns null if allowed; or an error message if rate limited / locked out.
 * The per-IP volumetric check goes through checkRateLimitAsync (Upstash, then a Neon-backed
 * table, then in-memory as a last resort) instead of a plain per-instance map. On Vercel,
 * concurrent requests fan out across many isolated function instances, each with its own empty
 * map, so an attacker with enough concurrency (or just natural instance churn) never
 * accumulated the 8 failures against any single instance's map, and the "15-minute lockout"
 * was largely bypassable. The per-email failed-attempt lockout stays in-memory for now: it's a
 * different mechanism (a failure counter with its own timeout, not a sliding request window),
 * and bcrypt's own per-guess cost remains a real brake even when it doesn't accumulate
 * cross-instance.
 */
export async function checkLoginRateLimit(ip: string, email: string): Promise<string | null> {
  pruneEmail()

  const ipCheck = await checkRateLimitAsync(`login-ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_MS / 1000)
  if (!ipCheck.ok) {
    return 'Too many attempts. Try again in 15 minutes.'
  }

  const now = Date.now()
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
