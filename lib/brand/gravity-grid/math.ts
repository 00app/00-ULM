/**
 * Gravity Grid maths: pure functions, no DOM, no allocation. Tested by
 * scripts/verify-gravity-grid.ts (npm run test:gravity-grid).
 */
import { FIELD } from '@/lib/brand/field'

/**
 * Lens profile: how far a dot at distance d from a well is pulled toward it.
 * Zero at d = 0 (the dot under the finger stays put), peaks at `amp` when d = sigma,
 * then falls away like a Gaussian.
 */
export function lens(d: number, amp: number, sigma: number): number {
  const u = d / sigma
  return amp * u * Math.exp(0.5 - 0.5 * u * u)
}

/**
 * Pull vector for a dot whose vector to the well is (dx, dy) and distance is d.
 * Length = min(lens(d) * strength, maxShare * d), pointing toward the well; zero beyond reach.
 * Writes [x, y] into `out` and returns it, so hot loops can reuse one scratch array.
 */
export function pullOffset(
  dx: number,
  dy: number,
  d: number,
  strength: number,
  amp: number,
  sigma: number,
  reach: number,
  out: Float64Array | number[],
  maxShare: number = FIELD.pull.maxShareOfDistance,
): Float64Array | number[] {
  if (d <= 0 || d >= reach || strength <= 0) {
    out[0] = 0
    out[1] = 0
    return out
  }
  let len = lens(d, amp, sigma) * strength
  const cap = maxShare * d
  if (len > cap) len = cap
  const k = len / d
  out[0] = dx * k
  out[1] = dy * k
  return out
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Trace tint at distance d from the trace: a Gaussian scaled by strength, clamped to 0..1. */
export function tint(d: number, sigma: number, strength: number): number {
  const u = d / sigma
  return clamp(Math.exp(-0.5 * u * u) * strength, 0, 1)
}

/** 1 for the newest trace sample, falling linearly to `floor` at windowMs and older. */
export function traceStrength(
  ageMs: number,
  windowMs: number = FIELD.trace.windowMs,
  floor: number = FIELD.trace.floor,
): number {
  if (ageMs <= 0) return 1
  if (ageMs >= windowMs) return floor
  return 1 - (1 - floor) * (ageMs / windowMs)
}

/** Natural frequency (rad/s) that settles a spring with damping ratio zeta in about settleMs. */
export function omegaFor(settleMs: number, zeta: number): number {
  return 4.6 / (Math.max(zeta, 0.3) * (settleMs / 1000))
}

/**
 * One spring step toward `target`. Semi-implicit Euler with the damping term taken implicitly,
 * so it stays stable for dt up to 1/30 s even at the stiff touch-in frequency.
 * Writes [x, v] into `out` and returns it.
 */
export function springStep(
  x: number,
  v: number,
  target: number,
  dt: number,
  omega: number,
  zeta: number,
  out: Float64Array | number[],
): Float64Array | number[] {
  const nv = (v - omega * omega * (x - target) * dt) / (1 + 2 * zeta * omega * dt)
  out[0] = x + nv * dt
  out[1] = nv
  return out
}

/**
 * CSS-style cubic-bezier easing (x1, y1, x2, y2) → t ↦ y. Newton steps with a bisection
 * fallback. Build once; calling the returned function does not allocate.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx

  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let s = t
    for (let i = 0; i < 6; i++) {
      const err = sampleX(s) - t
      if (Math.abs(err) < 1e-6) return sampleY(s)
      const d = slopeX(s)
      if (Math.abs(d) < 1e-6) break
      s -= err / d
    }
    let lo = 0
    let hi = 1
    s = t
    for (let i = 0; i < 30; i++) {
      const x = sampleX(s)
      if (Math.abs(x - t) < 1e-6) break
      if (x < t) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return sampleY(s)
  }
}

/** The brand ease, [0.22, 1, 0.36, 1]. */
export const brandEase = cubicBezier(FIELD.ease[0], FIELD.ease[1], FIELD.ease[2], FIELD.ease[3])
