import crypto from 'crypto'
import { isSessionSigningConfigured } from '@/lib/sessionCookieSign'

const SEP = '.'
/** Match profile-only session window (7 days) — limits XSS exfil + replay window. */
export const SESSION_RESTORE_PROOF_TTL_MS = 7 * 24 * 60 * 60 * 1000
const TTL_MS = SESSION_RESTORE_PROOF_TTL_MS

const USER_ID_IN_PROOF_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Parse user id from proof payload without verifying HMAC (client-safe peek). */
export function peekUserIdFromRestoreProof(proof: string | null | undefined): string | null {
  if (!proof?.trim()) return null
  const parts = proof.trim().split(SEP)
  if (parts.length !== 3) return null
  const uid = parts[0]?.trim() ?? ''
  return USER_ID_IN_PROOF_RE.test(uid) ? uid : null
}

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

/** Verified user id from restore proof — server-side only. */
export function resolveUserIdFromRestoreProof(proof: string | null | undefined): string | null {
  const uid = peekUserIdFromRestoreProof(proof)
  if (!uid) return null
  if (!verifySessionRestoreProof(uid, proof)) return null
  return uid
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
