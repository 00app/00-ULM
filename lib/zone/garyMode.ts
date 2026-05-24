/**
 * Client research identity — session-backed user id only.
 * Legacy demo UUID blocked; session init at /profile.
 */

import { safeGetItem } from '@/lib/zone/safeProfileStorage'

export const RESEARCH_USER_ID_STORAGE_KEY = 'zz_research_user_id'
export const LEGACY_DEMO_USER_ID = '00000000-0000-4000-a000-000000000000'
export const SESSION_INIT_PATH = '/profile'

export function isValidResearchUserId(v: string | null | undefined): boolean {
  const raw = String(v ?? '').trim()
  if (isLegacyDemoUserId(raw)) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
}

export function isLegacyDemoUserId(id: string | null | undefined): boolean {
  return String(id ?? '').trim().toLowerCase() === LEGACY_DEMO_USER_ID.toLowerCase()
}

/** User id persisted after POST /api/user — never mints a new UUID. */
export function resolveClientResearchUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    for (const key of [RESEARCH_USER_ID_STORAGE_KEY, 'user_id', 'profile_user_id', 'userId']) {
      const raw = safeGetItem(key)?.trim()
      if (isLegacyDemoUserId(raw)) continue
      if (isValidResearchUserId(raw)) return raw!
    }
  } catch {
    /* ignore */
  }
  return null
}

/** @deprecated No client UUID minting — returns session-persisted id only. */
export function ensureClientResearchUserId(_postcode?: string | null): string | null {
  return resolveClientResearchUserId()
}

/** Server derives identity from session / zz_sid — do not append spoofable user_id. */
export function appendResearchUserIdQuery(url: string): string {
  return url
}

/**
 * Clear legacy demo UUID from storage; redirect to profile session init when detected.
 * Returns true if a redirect was triggered.
 */
export function guardLegacyDemoIdentityOnClient(): boolean {
  if (typeof window === 'undefined') return false
  let hadLegacy = false
  try {
    for (const key of [RESEARCH_USER_ID_STORAGE_KEY, 'user_id', 'profile_user_id', 'userId']) {
      const raw = safeGetItem(key)?.trim()
      if (isLegacyDemoUserId(raw)) {
        localStorage.removeItem(key)
        hadLegacy = true
      }
    }
    localStorage.removeItem('zz_gary_mode')
  } catch {
    /* ignore */
  }
  if (
    hadLegacy &&
    !window.location.pathname.startsWith(SESSION_INIT_PATH) &&
    !window.location.pathname.startsWith('/intro')
  ) {
    window.location.href = SESSION_INIT_PATH
    return true
  }
  return hadLegacy
}
