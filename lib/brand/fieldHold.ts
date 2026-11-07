/**
 * Lets other motion pause the Gravity Grid so the two never do heavy work in the same frame.
 * The 00 Family Liquid transitions (route page-enter, card ↔ Solo Focus morph) call
 * `holdField(ms)`; the GravityGrid component pauses until the longest hold has passed.
 */
type Listener = (until: number) => void

let holdUntil = 0
const listeners = new Set<Listener>()

/** Pause the field for `ms` from now (extends any hold already running). */
export function holdField(ms: number): void {
  if (typeof performance === 'undefined') return
  const until = performance.now() + ms
  if (until <= holdUntil) return
  holdUntil = until
  listeners.forEach((fn) => fn(until))
}

export function subscribeFieldHold(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
