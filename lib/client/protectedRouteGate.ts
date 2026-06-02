/**
 * Client-side gate for protected AI routes (discovery pulse, injections, tips-refresh, content-architect).
 * Waits for /api/session-state so zz_sid cookie exists before firing protected calls.
 */

import {
  clearAiRouteBlockedClient,
  isAiRouteBlockedClient,
  markAiRouteBlockedFromStatus,
} from '@/lib/intelligence/aiRouteClientGuard'
import { ensureProfileSession } from '@/lib/client/ensureProfileSession'

export const SESSION_BOOTSTRAP_EVENT = 'zz-session-bootstrap'

export type SessionBootstrapResult = {
  ok: boolean
  sessionReady: boolean
}

let bootstrapPromise: Promise<SessionBootstrapResult> | null = null
let lastResult: SessionBootstrapResult = { ok: false, sessionReady: false }

function dispatchBootstrap(result: SessionBootstrapResult): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<SessionBootstrapResult>(SESSION_BOOTSTRAP_EVENT, { detail: result })
  )
}

/**
 * Single-flight session bootstrap. Safe to call from SessionStateRehydrate and ClientSessionBootstrap.
 */
export function ensureSessionBootstrap(): Promise<SessionBootstrapResult> {
  if (typeof window === 'undefined') {
    return Promise.resolve({ ok: false, sessionReady: false })
  }

  if (lastResult.sessionReady) {
    return Promise.resolve(lastResult)
  }

  if (!bootstrapPromise) {
    bootstrapPromise = ensureProfileSession()
      .then(() =>
        fetch('/api/session-state', { credentials: 'include', cache: 'no-store' })
      )
      .then((res) => {
        const sessionReady = res.ok
        if (sessionReady) {
          clearAiRouteBlockedClient()
        } else if (res.status === 401 || res.status === 429) {
          markAiRouteBlockedFromStatus(res.status)
        }
        const result: SessionBootstrapResult = { ok: res.ok, sessionReady }
        lastResult = result
        dispatchBootstrap(result)
        return result
      })
      .catch(() => {
        const result: SessionBootstrapResult = { ok: false, sessionReady: false }
        lastResult = result
        dispatchBootstrap(result)
        return result
      })
      .finally(() => {
        bootstrapPromise = null
      })
  }

  return bootstrapPromise
}

export function getSessionBootstrapSnapshot(): SessionBootstrapResult {
  return lastResult
}

export function canCallProtectedRoutes(): boolean {
  if (typeof window === 'undefined') return false
  return lastResult.sessionReady && !isAiRouteBlockedClient()
}

export async function waitForProtectedRoutesReady(timeoutMs = 8000): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (canCallProtectedRoutes()) return true

  const timeout = Math.max(500, timeoutMs)
  const started = Date.now()

  while (Date.now() - started < timeout) {
    const snap = getSessionBootstrapSnapshot()
    if (snap.sessionReady) return true
    await ensureSessionBootstrap()
    await new Promise((r) => setTimeout(r, 120))
  }

  return getSessionBootstrapSnapshot().sessionReady
}

export function markProtectedRouteFailure(status: number): boolean {
  return markAiRouteBlockedFromStatus(status)
}
