export const RESTORE_PROOF_LS = 'zz_session_restore_proof'

export function persistSessionRestoreProof(proof: string | null | undefined): void {
  if (typeof window === 'undefined' || !proof?.trim()) return
  try {
    localStorage.setItem(RESTORE_PROOF_LS, proof.trim())
  } catch {
    /* ignore */
  }
}

export function readSessionRestoreProof(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(RESTORE_PROOF_LS)?.trim()
    return v || null
  } catch {
    return null
  }
}
