import crypto from 'crypto'
import { isSessionSigningConfigured } from '@/lib/sessionCookieSign'

const SEP = '.'
/** Match profile-only session window (7 days) — proof must outlive typical cookie gap. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET?.trim()
  return s && s.length >= 16 ? s : null
}

/** HMAC proof issued at login/signup — required to restore session without password. */
export function issueSessionRestoreProof(userId: string): string | null {
  const sec = sessionSecret()
  if (!sec) return null
  const exp = Date.now() + TTL_MS
  const payload = `${userId}${SEP}${exp}`
  const sig = crypto.createHmac('sha256', sec).update(payload).digest('base64url')
  return `${payload}${SEP}${sig}`
}

export function verifySessionRestoreProof(userId: string, proof: string | null | undefined): boolean {
  const sec = sessionSecret()
  if (!sec || !proof?.trim()) return false
  const parts = proof.trim().split(SEP)
  if (parts.length !== 3) return false
  const [uid, expStr, sig] = parts
  if (uid !== userId) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const payload = `${uid}${SEP}${expStr}`
  const expected = crypto.createHmac('sha256', sec).update(payload).digest('base64url')
  if (sig.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

/** Dev-only fallback when SESSION_SECRET is unset (never in production). */
export function allowInsecureDevSessionRestore(): boolean {
  return process.env.NODE_ENV !== 'production' && !isSessionSigningConfigured()
}

export function withRestoreProof<T extends Record<string, unknown>>(
  body: T,
  userId: string
): T & { restore_proof?: string } {
  const proof = issueSessionRestoreProof(userId)
  return proof ? { ...body, restore_proof: proof } : body
}
