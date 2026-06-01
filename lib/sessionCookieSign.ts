import crypto from 'crypto'

const SEP = '.'

const SESSION_TOKEN_RE = /^[a-f0-9]{64}$/
const GUEST_SESSION_ID_RE = /^sess_[a-f0-9]{48}$/

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET?.trim()
  return s && s.length >= 16 ? s : null
}

/** Fail fast when production would issue unsigned cookies. */
export function assertSessionSecretConfigured(): void {
  if (isProduction() && !sessionSecret()) {
    throw new Error('SESSION_SECRET must be set (≥16 characters) in production')
  }
}

export function isSessionSigningConfigured(): boolean {
  return sessionSecret() != null
}

function hmacSig(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function signPayload(payload: string): string {
  const secret = sessionSecret()
  if (!secret) {
    if (isProduction()) {
      throw new Error('SESSION_SECRET must be set (≥16 characters) in production')
    }
    return payload
  }
  return `${payload}${SEP}${hmacSig(payload, secret)}`
}

function verifySigned(signed: string): string | null {
  const trimmed = signed.trim()
  if (!trimmed) return null

  const secret = sessionSecret()
  if (!secret) {
    if (isProduction()) return null
    if (SESSION_TOKEN_RE.test(trimmed) || GUEST_SESSION_ID_RE.test(trimmed)) return trimmed
    return null
  }

  const dot = trimmed.lastIndexOf(SEP)
  if (dot <= 0) return null

  const payload = trimmed.slice(0, dot)
  const sig = trimmed.slice(dot + 1)

  const expected = hmacSig(payload, secret)
  if (sig.length !== expected.length) return null
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return payload
}

/** Seal DB session token for HTTP-only `session` cookie. */
export function sealSessionToken(token: string): string {
  return signPayload(token)
}

/** Parse `session` cookie → raw DB token (HMAC required when `SESSION_SECRET` is set). */
export function unsealSessionToken(signed: string): string | null {
  const payload = verifySigned(signed)
  if (!payload || !SESSION_TOKEN_RE.test(payload)) return null
  return payload
}

/** Seal guest `zz_sid` session id. */
export function sealGuestSessionId(sessionId: string): string {
  return signPayload(sessionId)
}

/** Parse `zz_sid` cookie → raw session id (HMAC required when `SESSION_SECRET` is set). */
export function unsealGuestSessionId(signed: string): string | null {
  const payload = verifySigned(signed)
  if (!payload || !GUEST_SESSION_ID_RE.test(payload)) return null
  return payload
}
