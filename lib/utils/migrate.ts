/**
 * v1.8.3 — Clear localStorage for a clean test surface; keep identity + profile keys only.
 */
const KEEP_EXACT = new Set(['userId', 'user_id'])

function keepKey(key: string): boolean {
  if (KEEP_EXACT.has(key)) return true
  if (key.startsWith('profile_')) return true
  return false
}

/** Remove all keys except `userId` / `user_id` and `profile_*`. Safe to call from client only. */
export function clearLocalStorageExceptProfileAndUser(): void {
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && !keepKey(k)) keys.push(k)
    }
    keys.forEach((k) => window.localStorage.removeItem(k))
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k) window.sessionStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}
