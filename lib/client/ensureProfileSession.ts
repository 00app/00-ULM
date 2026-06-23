import {
  persistSessionRestoreProof,
  readSessionRestoreProof,
  peekUserIdFromRestoreProof,
} from '@/lib/client/sessionRestoreProofStorage'

const SESSION_COOKIE_RE = /(?:^|;\s*)session=/

let restorePromise: Promise<boolean> | null = null

function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false
  return SESSION_COOKIE_RE.test(document.cookie)
}

function profileLooksComplete(): boolean {
  if (typeof window === 'undefined') return false
  const postcode = (localStorage.getItem('profile_postcode') ?? '').replace(/\s+/g, '').trim()
  const name = (localStorage.getItem('profile_name') ?? '').trim()
  return postcode.length >= 4 && name.length > 0
}

/**
 * Ensures a signed-in session exists when the user completed profile onboarding
 * but the httpOnly session cookie expired (fixes /api/answers and /api/likes 401 loops).
 */
export async function ensureProfileSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (hasSessionCookie()) return true
  if (!profileLooksComplete()) return false

  const restoreProof = readSessionRestoreProof()
  const userId = peekUserIdFromRestoreProof(restoreProof)
  if (!restoreProof || !userId) return false

  if (!restorePromise) {
    restorePromise = fetch('/api/auth/restore-session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore_proof: restoreProof }),
    })
      .then(async (res) => {
        if (!res.ok) return false
        try {
          const data = (await res.json()) as { restore_proof?: string }
          persistSessionRestoreProof(data.restore_proof)
        } catch {
          /* ignore */
        }
        return true
      })
      .catch(() => false)
      .finally(() => {
        restorePromise = null
      })
  }

  return restorePromise
}

export function hasAuthenticatedSessionHint(): boolean {
  return hasSessionCookie() || Boolean(readSessionRestoreProof())
}

export { persistSessionRestoreProof }
