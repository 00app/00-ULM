/**
 * In-app navigation trail (per tab, sessionStorage), so back / close buttons can return to the
 * page you actually came from instead of always to Zone. Recorded by GlobalAppShell on every
 * pathname change; a move back to the previous entry pops the trail rather than pushing, so it
 * mirrors the browser's own history for in-app pages.
 */

const KEY = 'zz_nav_trail_v1'
const MAX = 40

function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(trail: string[]) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX)))
  } catch {
    /* storage blocked: buttons fall back to their parent page */
  }
}

export type NavKind = 'forward' | 'back' | 'same'

/** Record a page view and say whether it was a move back. Pure rules: `nextTrail`. */
export function recordInAppPath(path: string): NavKind {
  if (typeof window === 'undefined' || !path) return 'same'
  const trail = read()
  const next = nextTrail(trail, path)
  write(next)
  if (next.length === trail.length) return 'same'
  return next.length < trail.length ? 'back' : 'forward'
}

// ── Scroll memory: where you were on each page, restored when you come back to it ─────────

const SCROLL_KEY = 'zz_nav_scroll_v1'

export function saveScrollFor(path: string, y: number): void {
  if (typeof window === 'undefined' || !path) return
  try {
    const raw = window.sessionStorage.getItem(SCROLL_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    map[path] = Math.max(0, Math.round(y))
    window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function readScrollFor(path: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SCROLL_KEY)
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>)[path] : null
    return typeof v === 'number' && v > 0 ? v : null
  } catch {
    return null
  }
}

/**
 * Scroll back to `y` once the page is tall enough: pages like Zone render their content a moment
 * after the route appears, so the browser's own restore lands at the top. Gives up after ~4s or
 * as soon as the person scrolls themselves.
 */
export function restoreScrollWhenReady(y: number): () => void {
  let tries = 0
  let cancelled = false
  const stop = () => {
    cancelled = true
  }
  window.addEventListener('wheel', stop, { once: true, passive: true })
  window.addEventListener('touchstart', stop, { once: true, passive: true })
  window.addEventListener('keydown', stop, { once: true })
  const tick = () => {
    if (cancelled) return
    const tallEnough = document.documentElement.scrollHeight - window.innerHeight >= y - 4
    if (tallEnough) {
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
      // Content can still grow and nudge the page right after; settle once more.
      if (tries < 40 && Math.abs(window.scrollY - y) > 4) {
        tries += 1
        window.setTimeout(tick, 100)
      }
      return
    }
    if (++tries > 40) return
    window.setTimeout(tick, 100)
  }
  window.setTimeout(tick, 0)
  return stop
}

export function nextTrail(trail: readonly string[], path: string): string[] {
  const last = trail[trail.length - 1]
  if (last === path) return [...trail]
  // Going back to the previous page (browser back or our back button): pop, don't push.
  if (trail.length >= 2 && trail[trail.length - 2] === path) return trail.slice(0, -1)
  return [...trail, path]
}

/** True when the page before this one in this tab was an in-app page. */
export function hasInAppPrevious(): boolean {
  return read().length >= 2
}
