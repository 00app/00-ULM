import { ensureProfileSession } from '@/lib/client/ensureProfileSession'
import {
  persistSessionRestoreProof,
  readSessionRestoreProof,
} from '@/lib/client/sessionRestoreProofStorage'

type JsonBody = Record<string, unknown>

function mergeRestoreProof(body: JsonBody): JsonBody {
  const proof = readSessionRestoreProof()
  if (!proof) return body
  if (typeof body.restore_proof === 'string' && body.restore_proof.trim()) return body
  return { ...body, restore_proof: proof }
}

/** POST with session restore + restore_proof for profile users with expired cookies. */
export async function authenticatedPost(
  url: string,
  body: JsonBody,
  init?: Omit<RequestInit, 'method' | 'body' | 'credentials'>
): Promise<Response> {
  await ensureProfileSession()
  let res = await fetch(url, {
    ...init,
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(mergeRestoreProof(body)),
  })
  if (res.status !== 401) return res

  const restored = await ensureProfileSession({ forceRestore: true })
  if (!restored) return res

  res = await fetch(url, {
    ...init,
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(mergeRestoreProof(body)),
  })
  return res
}

/** GET after session restore — refreshes restore_proof from restore-session when issued. */
export async function authenticatedGet(
  url: string,
  init?: Omit<RequestInit, 'method' | 'credentials'>
): Promise<Response> {
  await ensureProfileSession()
  return fetch(url, { ...init, method: 'GET', credentials: 'include' })
}

export function persistRestoreProofFromResponse(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const proof = (data as { restore_proof?: unknown }).restore_proof
  if (typeof proof === 'string' && proof.trim()) {
    persistSessionRestoreProof(proof)
  }
}
