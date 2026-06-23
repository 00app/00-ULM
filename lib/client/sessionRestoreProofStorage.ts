const USER_ID_IN_PROOF_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const RESTORE_PROOF_SS = 'zz_session_restore_proof'
/** @deprecated Migrated to sessionStorage — cleared on read */
export const RESTORE_PROOF_LS = 'zz_session_restore_proof'

const LEGACY_USER_ID_KEYS = ['userId', 'user_id', 'profile_user_id', 'zz_research_user_id'] as const

/** Parse user id from proof payload without verifying HMAC (client-safe). */
export function peekUserIdFromRestoreProof(proof: string | null | undefined): string | null {
  if (!proof?.trim()) return null
  const parts = proof.trim().split('.')
  if (parts.length !== 3) return null
  const uid = parts[0]?.trim() ?? ''
  return USER_ID_IN_PROOF_RE.test(uid) ? uid : null
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Drop legacy localStorage auth artefacts (M-6). */
export function clearLegacyAuthLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    for (const key of [...LEGACY_USER_ID_KEYS, RESTORE_PROOF_LS]) {
      localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

function migrateProofFromLocalStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const legacy = localStorage.getItem(RESTORE_PROOF_LS)?.trim()
    if (!legacy) return null
    const ss = storage()
    if (ss) ss.setItem(RESTORE_PROOF_SS, legacy)
    localStorage.removeItem(RESTORE_PROOF_LS)
    clearLegacyAuthLocalStorage()
    return legacy
  } catch {
    return null
  }
}

export function persistSessionRestoreProof(proof: string | null | undefined): void {
  const ss = storage()
  if (!ss || !proof?.trim()) return
  try {
    ss.setItem(RESTORE_PROOF_SS, proof.trim())
    clearLegacyAuthLocalStorage()
  } catch {
    /* ignore */
  }
}

export function readSessionRestoreProof(): string | null {
  const ss = storage()
  if (!ss) return null
  try {
    let v = ss.getItem(RESTORE_PROOF_SS)?.trim()
    if (!v) v = migrateProofFromLocalStorage() ?? undefined
    return v || null
  } catch {
    return null
  }
}

/** User id embedded in HMAC proof — no separate localStorage UUID (M-6). */
export function readAuthenticatedUserIdHint(): string | null {
  return peekUserIdFromRestoreProof(readSessionRestoreProof())
}
