/**
 * Gravity Grid engine: framework-free. One canvas of pale dots that bend toward the finger or
 * cursor, leave a faint blue trace and settle back. Tokens: lib/brand/field.ts. Brand rules:
 * docs/BRAND-LANGUAGE.md ("Gravity Grid").
 *
 * Coordinates are CSS px in viewport space (the canvas is fixed to the viewport).
 *
 * Performance notes:
 * - Dots sit on a regular grid, so "dots near a point" is a direct row/column range (a perfect
 *   spatial hash), and only dots in an active set are stepped each frame.
 * - Each dot caches its nearest trace sample; a new sample only updates the dots within reach
 *   of it, and a dot re-searches only when its nearest sample drops off the trace.
 * - No allocation inside the frame loop. The loop sleeps once everything is settled.
 */
import { FIELD } from '@/lib/brand/field'
import {
  brandEase,
  clamp,
  omegaFor,
  pullOffset,
  springStep,
  tint as tintAt,
  traceStrength,
} from './math'

export type PointerKind = 'mouse' | 'touch' | 'pen' | (string & {})

export interface QuietRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface GravityGridOptions {
  reducedMotion?: boolean
  /** Defaults to FIELD.spring.bounce. */
  bounce?: boolean
  /** Test hooks. Default to performance.now / requestAnimationFrame / the canvas 2D context. */
  now?: () => number
  requestFrame?: (cb: (time: number) => void) => number
  cancelFrame?: (id: number) => void
  context?: CanvasRenderingContext2D | null
}

export interface GravityGridStats {
  dots: number
  cols: number
  rows: number
  active: number
  awake: boolean
  frames: number
  /** Moving average of the engine's own work per frame, ms. */
  frameMs: number
  /** True once the renderer has fallen back to 2×2 rects. */
  rects: boolean
  /** Largest |offset| among dots, px. */
  maxOffset: number
  /** Count of dots currently in a tinted colour bucket. */
  tinted: number
  /** Highest colour bucket of any dot right now (0 = rest colour, buckets − 1 = full blue). */
  maxBucket: number
}

export interface GravityGrid {
  setSize(w: number, h: number, dpr: number): void
  pointerDown(x: number, y: number, pointerType: PointerKind): void
  pointerMove(x: number, y: number, pointerType: PointerKind, buttons: number): void
  pointerUp(x: number, y: number): void
  pointerCancel(): void
  /** Cursor left the window: hover well springs home. */
  pointerLeave(): void
  scroll(dy: number, dtMs: number): void
  clearTrace(): void
  setQuietRects(rects: ArrayLike<QuietRect>): void
  setReducedMotion(reduced: boolean): void
  setBounce(bounce: boolean): void
  pause(): void
  resume(): void
  destroy(): void
  getStats(): GravityGridStats
}

// ---------------------------------------------------------------------------------------------
// Constants from tokens
// ---------------------------------------------------------------------------------------------

const P = FIELD.grid.pitch
const HALF = P / 2
const DOT_R = FIELD.grid.dotRadius
const TAU = Math.PI * 2

const PULL_AMP = FIELD.pull.amp
const PULL_SIGMA = FIELD.pull.sigma
const PULL_REACH = FIELD.pull.reach
const PULL_REACH2 = PULL_REACH * PULL_REACH

/** Taps and hover use 3σ as reach: the lens is under 0.4px there, so the cut is invisible. */
const TAP_AMP = FIELD.tap.amp
const TAP_SIGMA = FIELD.tap.sigma
const TAP_REACH = 3 * FIELD.tap.sigma
const TAP_MAX_MS = FIELD.tap.maxMs
const TAP_MAX_MOVE = FIELD.tap.maxMove

const HOVER_AMP = FIELD.hover.amp
const HOVER_SIGMA = FIELD.hover.sigma
const HOVER_REACH = 3 * FIELD.hover.sigma
const HOVER_IDLE_MS = FIELD.hover.idleMs

const TINT_SIGMA = FIELD.tint.sigma
const TINT_CAP_QUIET = FIELD.tint.capQuiet
/** Quiet rects grow by the largest pull, so dots pulled into a text block are capped too. */
const QUIET_MARGIN = Math.max(FIELD.pull.amp, FIELD.tap.amp, FIELD.hover.amp)
const TRACE_REST = FIELD.tint.traceRest
const GAMMA = FIELD.tint.gamma
const BUCKETS = FIELD.tint.buckets
/** Below this a dot's tint is not worth tracking (well under one colour bucket). */
const TINT_MIN = 0.01

const TOUCH_IN_MS = FIELD.time.touchIn
const RELEASE_MS = FIELD.time.release
const TRACE_FADE_MS = FIELD.time.traceFade
const CLEAR_FADE_MS = FIELD.time.clearFade
const SCROLL_SETTLE_MS = FIELD.time.scrollSettle
const TAP_LIFE_MS = FIELD.time.tapLife

const TRACE_FLOOR = FIELD.trace.floor
const TRACE_WINDOW_MS = FIELD.trace.windowMs
const SAMPLE_SPACING = FIELD.trace.sampleSpacing
const MAX_SAMPLES = FIELD.trace.maxSamples
/** Fast swipes are filled in at sample spacing, up to this many samples per move event. */
const MAX_FILL = 24

const SCROLL_MAX_LAG = FIELD.scroll.maxLag
const SCROLL_LEAD = FIELD.scroll.leadFalloff
const SCROLL_GAIN = FIELD.scroll.gain
/** No scroll event for this long counts as "scroll stopped". */
const SCROLL_IDLE_MS = 80

const MAX_OVERSHOOT = FIELD.spring.maxOvershoot
const OMEGA_IN = omegaFor(TOUCH_IN_MS, 1)
const OMEGA_SCROLL_OUT = omegaFor(SCROLL_SETTLE_MS, 1)

const EPS = 0.01
/** Largest distance a dot is drawn from its rest point (pull plus overshoot, with margin). */
const MAX_DRAW_OFFSET = FIELD.pull.amp + FIELD.spring.maxOvershoot + 8
const MAX_TAPS = 8
/** Frame-time budget before falling back to 2×2 rects. */
const FRAME_BUDGET_MS = 8
const PERF_WARMUP_FRAMES = 30

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function bucketColours(): string[] {
  const a = hexToRgb(FIELD.colours.rest)
  const b = hexToRgb(FIELD.colours.blue)
  const out: string[] = []
  for (let k = 0; k < BUCKETS; k++) {
    const t = k / (BUCKETS - 1)
    const r = Math.round(a[0] + (b[0] - a[0]) * t)
    const g = Math.round(a[1] + (b[1] - a[1]) * t)
    const bl = Math.round(a[2] + (b[2] - a[2]) * t)
    out.push(`rgb(${r},${g},${bl})`)
  }
  return out
}

const COLOURS = bucketColours()

// ---------------------------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------------------------

export function createGravityGrid(
  canvas: HTMLCanvasElement,
  opts: GravityGridOptions = {},
): GravityGrid | null {
  const ctx = opts.context !== undefined ? opts.context : canvas.getContext('2d')
  if (!ctx) return null

  const now = opts.now ?? (() => performance.now())
  const requestFrame = opts.requestFrame ?? ((cb: (time: number) => void) => window.requestAnimationFrame(cb))
  const cancelFrame = opts.cancelFrame ?? ((id: number) => window.cancelAnimationFrame(id))

  let reduced = Boolean(opts.reducedMotion)
  let bounce = opts.bounce ?? FIELD.spring.bounce
  let zetaRel = bounce ? FIELD.spring.zetaBounce : FIELD.spring.zetaNoBounce
  let omegaRel = omegaFor(RELEASE_MS, zetaRel)

  // Geometry
  let W = 0
  let H = 0
  let cols = 0
  let rows = 0
  let n = 0
  let cap = 0

  // Per-dot state
  let restX = new Float32Array(0)
  let restY = new Float32Array(0)
  let offX = new Float32Array(0)
  let offY = new Float32Array(0)
  let velX = new Float32Array(0)
  let velY = new Float32Array(0)
  let tgtX = new Float32Array(0)
  let tgtY = new Float32Array(0)
  let relX = new Float32Array(0)
  let relY = new Float32Array(0)
  let tint = new Float32Array(0)
  let tintTarget = new Float32Array(0)
  let tintFrom = new Float32Array(0)
  let tintTo = new Float32Array(0)
  let tintBase = new Float32Array(0)
  let tintDur = new Float32Array(0)
  let tintT0 = new Float64Array(0)
  /** 0 hold, 1 following a live well, 2 fading. */
  let tintMode = new Uint8Array(0)
  let held = new Uint8Array(0)
  let wasHeld = new Uint8Array(0)
  let tintHeld = new Uint8Array(0)
  let quiet = new Uint8Array(0)
  let isActive = new Uint8Array(0)
  let inTrace = new Uint8Array(0)
  let bucketOf = new Uint8Array(0)
  let nearId = new Int32Array(0)
  let nearD2 = new Float32Array(0)
  let activeList = new Int32Array(0)
  let traceList = new Int32Array(0)
  let order = new Int32Array(0)
  let sorted = new Int32Array(0)
  let activeCount = 0
  let traceCount = 0
  let rowLag = new Float32Array(0)

  const counts = new Int32Array(BUCKETS)
  const starts = new Int32Array(BUCKETS)
  const scratch = new Float64Array(2)

  // Trace samples (ring buffer; ids are monotonic, slot = id % MAX_SAMPLES)
  const sx = new Float32Array(MAX_SAMPLES)
  const sy = new Float32Array(MAX_SAMPLES)
  const st = new Float64Array(MAX_SAMPLES)
  let sampleTotal = 0
  let oldestId = 0
  let lastSX = 0
  let lastSY = 0
  let lastST = 0

  // Pointer
  let isDown = false
  let pending = false
  let dragging = false
  let downX = 0
  let downY = 0
  let downT = 0
  let ptrX = 0
  let ptrY = 0

  // Taps
  const tapX = new Float32Array(MAX_TAPS)
  const tapY = new Float32Array(MAX_TAPS)
  const tapT0 = new Float64Array(MAX_TAPS)
  const tapAlive = new Uint8Array(MAX_TAPS)
  const tapFresh = new Uint8Array(MAX_TAPS)

  // Hover
  let hoverOn = false
  let hoverX = 0
  let hoverY = 0
  let hoverT = 0

  // Scroll
  let lag = 0
  let lagVel = 0
  let lagTarget = 0
  let lastScrollT = -1e9
  let scrollDir = 1

  // Quiet rects (kept so a rebuild can re-apply them)
  let quietBuf = new Float32Array(0)
  let quietCount = 0

  // Loop
  let frameId = 0
  let paused = false
  let destroyed = false
  let lastT = 0
  let frames = 0
  let frameMs = 0
  let useRects = false
  let lagWasOn = false
  /** A full redraw is owed on the next frame (quiet rects or reduced motion changed while awake). */
  let fullNext = false
  /** Last frame's dirty box (Infinity = none). */
  let prevX0 = Infinity
  let prevY0 = 0
  let prevX1 = 0
  let prevY1 = 0
  let drawCount = 0

  // -------------------------------------------------------------------------------------------
  // Allocation (outside the frame loop only)
  // -------------------------------------------------------------------------------------------

  function grow(newCap: number, keep: number): void {
    const f32 = (a: Float32Array) => {
      const b = new Float32Array(newCap)
      if (keep > 0) b.set(a.subarray(0, keep))
      return b
    }
    const f64 = (a: Float64Array) => {
      const b = new Float64Array(newCap)
      if (keep > 0) b.set(a.subarray(0, keep))
      return b
    }
    const u8 = (a: Uint8Array) => {
      const b = new Uint8Array(newCap)
      if (keep > 0) b.set(a.subarray(0, keep))
      return b
    }
    const i32 = (a: Int32Array, fill = 0) => {
      const b = new Int32Array(newCap)
      if (fill !== 0) b.fill(fill)
      if (keep > 0) b.set(a.subarray(0, keep))
      return b
    }
    restX = new Float32Array(newCap)
    restY = new Float32Array(newCap)
    offX = f32(offX)
    offY = f32(offY)
    velX = f32(velX)
    velY = f32(velY)
    tgtX = f32(tgtX)
    tgtY = f32(tgtY)
    relX = f32(relX)
    relY = f32(relY)
    tint = f32(tint)
    tintTarget = f32(tintTarget)
    tintFrom = f32(tintFrom)
    tintTo = f32(tintTo)
    tintBase = f32(tintBase)
    tintDur = f32(tintDur)
    tintT0 = f64(tintT0)
    tintMode = u8(tintMode)
    held = u8(held)
    wasHeld = u8(wasHeld)
    tintHeld = u8(tintHeld)
    quiet = new Uint8Array(newCap)
    isActive = u8(isActive)
    inTrace = u8(inTrace)
    bucketOf = new Uint8Array(newCap)
    nearId = i32(nearId, -1)
    nearD2 = f32(nearD2)
    // Lists hold dot indices; carry them over as-is (indices < keep stay valid).
    const al = new Int32Array(newCap)
    al.set(activeList.subarray(0, Math.min(activeCount, newCap)))
    activeList = al
    const tl = new Int32Array(newCap)
    tl.set(traceList.subarray(0, Math.min(traceCount, newCap)))
    traceList = tl
    order = new Int32Array(newCap)
    sorted = new Int32Array(newCap)
    cap = newCap
  }

  function resetDots(from: number, to: number): void {
    offX.fill(0, from, to)
    offY.fill(0, from, to)
    velX.fill(0, from, to)
    velY.fill(0, from, to)
    tgtX.fill(0, from, to)
    tgtY.fill(0, from, to)
    relX.fill(0, from, to)
    relY.fill(0, from, to)
    tint.fill(0, from, to)
    tintTarget.fill(0, from, to)
    tintFrom.fill(0, from, to)
    tintTo.fill(0, from, to)
    tintBase.fill(0, from, to)
    tintDur.fill(0, from, to)
    tintT0.fill(0, from, to)
    tintMode.fill(0, from, to)
    held.fill(0, from, to)
    wasHeld.fill(0, from, to)
    tintHeld.fill(0, from, to)
    isActive.fill(0, from, to)
    inTrace.fill(0, from, to)
    nearId.fill(-1, from, to)
    nearD2.fill(0, from, to)
  }

  // -------------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------------

  function colLo(x: number): number {
    const c = Math.ceil((x - HALF) / P)
    return c < 0 ? 0 : c
  }
  function colHi(x: number): number {
    const c = Math.floor((x - HALF) / P)
    return c > cols - 1 ? cols - 1 : c
  }
  function rowLo(y: number): number {
    const r = Math.ceil((y - HALF) / P)
    return r < 0 ? 0 : r
  }
  function rowHi(y: number): number {
    const r = Math.floor((y - HALF) / P)
    return r > rows - 1 ? rows - 1 : r
  }

  function addActive(i: number): void {
    if (isActive[i] === 0) {
      isActive[i] = 1
      activeList[activeCount++] = i
    }
  }

  function wake(): void {
    if (destroyed || paused || frameId !== 0 || n === 0) return
    lastT = now()
    frameId = requestFrame(tick)
  }

  // -------------------------------------------------------------------------------------------
  // Trace
  // -------------------------------------------------------------------------------------------

  function addSample(x: number, y: number, t: number): void {
    if (sampleTotal - oldestId >= MAX_SAMPLES) oldestId++
    const id = sampleTotal++
    const s = id % MAX_SAMPLES
    sx[s] = x
    sy[s] = y
    st[s] = t
    lastSX = x
    lastSY = y
    lastST = t
    const r0 = rowLo(y - PULL_REACH)
    const r1 = rowHi(y + PULL_REACH)
    const c0 = colLo(x - PULL_REACH)
    const c1 = colHi(x + PULL_REACH)
    for (let r = r0; r <= r1; r++) {
      const base = r * cols
      for (let c = c0; c <= c1; c++) {
        const i = base + c
        const dx = x - restX[i]
        const dy = y - restY[i]
        const d2 = dx * dx + dy * dy
        if (d2 >= PULL_REACH2) continue
        if (nearId[i] < oldestId || d2 <= nearD2[i]) {
          nearId[i] = id
          nearD2[i] = d2
          if (inTrace[i] === 0) {
            inTrace[i] = 1
            traceList[traceCount++] = i
          }
        }
      }
    }
  }

  /** Path from the last sample to (x, y), filled in at sample spacing. */
  function appendPath(x: number, y: number, t: number): void {
    const dx = x - lastSX
    const dy = y - lastSY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < SAMPLE_SPACING) return
    let steps = Math.floor(dist / SAMPLE_SPACING)
    if (steps > MAX_FILL) steps = MAX_FILL
    const x0 = lastSX
    const y0 = lastSY
    const t0 = lastST
    for (let k = 1; k <= steps; k++) {
      const f = k / steps
      addSample(x0 + dx * f, y0 + dy * f, t0 + (t - t0) * f)
    }
  }

  /** Nearest live sample for dot i after its cached one dropped off. False if none in reach. */
  function research(i: number): boolean {
    const px = restX[i]
    const py = restY[i]
    let best = PULL_REACH2
    let bestId = -1
    for (let id = oldestId; id < sampleTotal; id++) {
      const s = id % MAX_SAMPLES
      const dx = sx[s] - px
      const dy = sy[s] - py
      const d2 = dx * dx + dy * dy
      if (d2 <= best) {
        best = d2
        bestId = id
      }
    }
    if (bestId < 0) {
      nearId[i] = -1
      return false
    }
    nearId[i] = bestId
    nearD2[i] = best
    return true
  }

  function startDrag(t: number): void {
    pending = false
    dragging = true
    oldestId = sampleTotal
    addSample(downX, downY, downT)
    appendPath(ptrX, ptrY, t)
  }

  function endDrag(): void {
    dragging = false
    oldestId = sampleTotal
    for (let k = 0; k < traceCount; k++) {
      const i = traceList[k]
      inTrace[i] = 0
      nearId[i] = -1
    }
    traceCount = 0
  }

  function spawnTap(x: number, y: number, t: number): void {
    let slot = -1
    let oldest = Infinity
    for (let k = 0; k < MAX_TAPS; k++) {
      if (tapAlive[k] === 0) {
        slot = k
        break
      }
      if (tapT0[k] < oldest) {
        oldest = tapT0[k]
        slot = k
      }
    }
    tapX[slot] = x
    tapY[slot] = y
    tapT0[slot] = t
    tapAlive[slot] = 1
    tapFresh[slot] = 1
  }

  // -------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------

  /** Point well over a region: pull (unless reduced motion) and optional tint. */
  function applyWell(
    x: number,
    y: number,
    reach: number,
    amp: number,
    sigma: number,
    tintStrength: number,
    fadeMs: number,
  ): void {
    const reach2 = reach * reach
    const r0 = rowLo(y - reach)
    const r1 = rowHi(y + reach)
    const c0 = colLo(x - reach)
    const c1 = colHi(x + reach)
    for (let r = r0; r <= r1; r++) {
      const base = r * cols
      for (let c = c0; c <= c1; c++) {
        const i = base + c
        const dx = x - restX[i]
        const dy = y - restY[i]
        const d2 = dx * dx + dy * dy
        if (d2 >= reach2) continue
        const d = Math.sqrt(d2)
        addActive(i)
        held[i] = 1
        if (!reduced) {
          pullOffset(dx, dy, d, 1, amp, sigma, reach, scratch)
          tgtX[i] += scratch[0]
          tgtY[i] += scratch[1]
        }
        if (tintStrength > 0) {
          const tv = tintAt(d, TINT_SIGMA, tintStrength)
          if (tv > TINT_MIN) {
            tintHeld[i] = 1
            if (tv > tintTarget[i]) {
              tintTarget[i] = tv
              tintDur[i] = fadeMs
            }
          }
        }
      }
    }
  }

  function tick(): void {
    frameId = 0
    if (destroyed || paused) return
    const t = now()
    let dtMs = t - lastT
    lastT = t
    if (dtMs > 100) dtMs = 100
    if (dtMs < 0) dtMs = 0
    const dt = dtMs / 1000

    // Long press without movement becomes a drag.
    if (isDown && pending && t - downT >= TAP_MAX_MS) startDrag(t)
    if (hoverOn && t - hoverT >= HOVER_IDLE_MS) hoverOn = false

    // --- Wells ---------------------------------------------------------------------------
    if (dragging) {
      for (let k = 0; k < traceCount; ) {
        const i = traceList[k]
        if (nearId[i] < oldestId && !research(i)) {
          inTrace[i] = 0
          traceList[k] = traceList[--traceCount]
          continue
        }
        const s = nearId[i] % MAX_SAMPLES
        const dx = sx[s] - restX[i]
        const dy = sy[s] - restY[i]
        const d = Math.sqrt(nearD2[i])
        const strength = traceStrength(t - st[s], TRACE_WINDOW_MS, TRACE_FLOOR)
        addActive(i)
        held[i] = 1
        if (!reduced) {
          pullOffset(dx, dy, d, strength, PULL_AMP, PULL_SIGMA, PULL_REACH, scratch)
          tgtX[i] += scratch[0]
          tgtY[i] += scratch[1]
        }
        const tv = tintAt(d, TINT_SIGMA, strength)
        if (tv > TINT_MIN) {
          tintHeld[i] = 1
          if (tv > tintTarget[i]) {
            tintTarget[i] = tv
            tintDur[i] = TRACE_FADE_MS
          }
        }
        k++
      }
    }

    let tapsAlive = false
    for (let k = 0; k < MAX_TAPS; k++) {
      if (tapAlive[k] === 0) continue
      const life = reduced ? 0 : TAP_LIFE_MS
      if (t - tapT0[k] > life && tapFresh[k] === 0) {
        tapAlive[k] = 0
        continue
      }
      tapFresh[k] = 0
      tapsAlive = true
      applyWell(tapX[k], tapY[k], TAP_REACH, TAP_AMP, TAP_SIGMA, 1, reduced ? TAP_LIFE_MS : TRACE_FADE_MS)
    }

    if (hoverOn && !isDown && !reduced) {
      applyWell(hoverX, hoverY, HOVER_REACH, HOVER_AMP, HOVER_SIGMA, FIELD.hover.tint, TRACE_FADE_MS)
    }

    // --- Dots ----------------------------------------------------------------------------
    const subs = dt <= 0 ? 0 : Math.min(6, Math.ceil(dt * 60))
    const h = subs > 0 ? dt / subs : 0
    const kFollow = reduced ? 1 : 1 - Math.exp((-dtMs * 4.6) / TOUCH_IN_MS)

    for (let a = 0; a < activeCount; ) {
      const i = activeList[a]
      const isHeld = held[i]

      // Motion
      if (reduced) {
        offX[i] = 0
        offY[i] = 0
        velX[i] = 0
        velY[i] = 0
      } else {
        if (isHeld === 0 && wasHeld[i] === 1) {
          relX[i] = offX[i]
          relY[i] = offY[i]
        }
        wasHeld[i] = isHeld
        const om = isHeld ? OMEGA_IN : omegaRel
        const ze = isHeld ? 1 : zetaRel
        let x = offX[i]
        let vx = velX[i]
        let y = offY[i]
        let vy = velY[i]
        const tx = tgtX[i]
        const ty = tgtY[i]
        for (let s = 0; s < subs; s++) {
          springStep(x, vx, tx, h, om, ze, scratch)
          x = scratch[0]
          vx = scratch[1]
          springStep(y, vy, ty, h, om, ze, scratch)
          y = scratch[0]
          vy = scratch[1]
        }
        if (isHeld === 0) {
          // The bounce is the only overshoot, and it is capped at maxOvershoot px.
          const rx = relX[i]
          const ry = relY[i]
          const rl2 = rx * rx + ry * ry
          if (rl2 > 0) {
            const rl = Math.sqrt(rl2)
            const ux = rx / rl
            const uy = ry / rl
            const proj = x * ux + y * uy
            if (proj < -MAX_OVERSHOOT) {
              const fix = -MAX_OVERSHOOT - proj
              x += ux * fix
              y += uy * fix
              const vp = vx * ux + vy * uy
              if (vp < 0) {
                vx -= ux * vp
                vy -= uy * vp
              }
            }
          }
        }
        offX[i] = x
        offY[i] = y
        velX[i] = vx
        velY[i] = vy
      }

      // Tint
      const mode = tintMode[i]
      if (tintHeld[i] === 1) {
        if (mode !== 1) {
          tintBase[i] = mode === 2 ? tintTo[i] : tint[i]
          tintMode[i] = 1
        }
        const goal = tintTarget[i] > tintBase[i] ? tintTarget[i] : tintBase[i]
        tint[i] += (goal - tint[i]) * kFollow
      } else if (mode === 1) {
        // Well released: ease to traceRest × current, then hold.
        const cur = tint[i]
        const rest = TRACE_REST * cur
        tintFrom[i] = cur
        tintTo[i] = rest > tintBase[i] ? rest : tintBase[i]
        tintT0[i] = t
        tintMode[i] = 2
      } else if (mode === 2) {
        const dur = tintDur[i] > 1 ? tintDur[i] : 1
        const p = (t - tintT0[i]) / dur
        if (p >= 1) {
          tint[i] = tintTo[i]
          tintMode[i] = 0
        } else {
          tint[i] = tintFrom[i] + (tintTo[i] - tintFrom[i]) * brandEase(p)
        }
      }

      // Clear this frame's inputs
      held[i] = 0
      tintHeld[i] = 0
      tintTarget[i] = 0
      tgtX[i] = 0
      tgtY[i] = 0

      // Sleep check
      if (
        isHeld === 0 &&
        tintMode[i] === 0 &&
        offX[i] < EPS &&
        offX[i] > -EPS &&
        offY[i] < EPS &&
        offY[i] > -EPS &&
        velX[i] < EPS &&
        velX[i] > -EPS &&
        velY[i] < EPS &&
        velY[i] > -EPS
      ) {
        offX[i] = 0
        offY[i] = 0
        velX[i] = 0
        velY[i] = 0
        wasHeld[i] = 0
        relX[i] = 0
        relY[i] = 0
        isActive[i] = 0
        activeList[a] = activeList[--activeCount]
        continue
      }
      a++
    }

    // --- Scroll lag ----------------------------------------------------------------------
    if (reduced) {
      lag = 0
      lagVel = 0
      lagTarget = 0
    } else {
      const scrolling = t - lastScrollT < SCROLL_IDLE_MS
      if (!scrolling) lagTarget = 0
      const om = scrolling ? OMEGA_IN : OMEGA_SCROLL_OUT
      for (let s = 0; s < subs; s++) {
        springStep(lag, lagVel, lagTarget, h, om, 1, scratch)
        lag = scratch[0]
        lagVel = scratch[1]
      }
      if (!scrolling && lag < EPS && lag > -EPS && lagVel < EPS && lagVel > -EPS) {
        lag = 0
        lagVel = 0
      }
    }

    render(fullNext)
    fullNext = false

    const work = now() - t
    frames++
    frameMs = frames === 1 ? work : frameMs * 0.9 + work * 0.1
    if (!useRects && frames > PERF_WARMUP_FRAMES && frameMs > FRAME_BUDGET_MS) {
      useRects = true
      // Partial redraws only repaint a box; repaint everything once so no round dots are left.
      fullNext = true
    }

    const awake =
      activeCount > 0 ||
      dragging ||
      (isDown && pending) ||
      hoverOn ||
      tapsAlive ||
      lag !== 0 ||
      lagTarget !== 0 ||
      fullNext
    if (awake) frameId = requestFrame(tick)
  }

  // -------------------------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------------------------

  /** Bucket for dot i (quiet cap applied). */
  function bucketFor(i: number): number {
    let tv = tint[i]
    if (tv <= 0.0005) return 0
    if (quiet[i] === 1 && tv > TINT_CAP_QUIET) tv = TINT_CAP_QUIET
    const b = Math.round(Math.pow(tv, GAMMA) * (BUCKETS - 1))
    return b > BUCKETS - 1 ? BUCKETS - 1 : b
  }

  /**
   * Draws a frame. Full redraw when asked (resize, quiet rects, reduced motion) or while scroll
   * lag shifts whole rows. Otherwise only the dirty box is cleared and redrawn: the union of
   * where moving dots are drawn now and where they were drawn last frame. Dots outside it are
   * unchanged on the canvas, so a tap or a short drag touches a few hundred dots, not all of them.
   */
  function render(full = false): void {
    const c = ctx as CanvasRenderingContext2D
    if (n === 0) {
      c.clearRect(0, 0, W + P, H + P)
      return
    }

    const lagOn = lag !== 0
    if (lagOn) {
      for (let r = 0; r < rows; r++) {
        const y = HALF + r * P
        let dist = scrollDir > 0 ? H - y : y
        if (dist < 0) dist = 0
        rowLag[r] = lag * Math.exp(-dist / SCROLL_LEAD)
      }
    }
    if (full || lagOn || lagWasOn) {
      lagWasOn = lagOn
      drawRange(0, rows - 1, 0, cols - 1)
      c.clearRect(0, 0, W + P, H + P)
      flush(c, lagOn)
      prevX0 = Infinity
      return
    }

    // Dirty box: moving dots now, plus last frame's box (where they were).
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let a = 0; a < activeCount; a++) {
      const i = activeList[a]
      const x = restX[i] + offX[i]
      const y = restY[i] + offY[i]
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const pad = DOT_R + 1
    let nx0 = x0 - pad
    let ny0 = y0 - pad
    let nx1 = x1 + pad
    let ny1 = y1 + pad
    const curX0 = nx0
    const curY0 = ny0
    const curX1 = nx1
    const curY1 = ny1
    if (prevX0 !== Infinity) {
      if (prevX0 < nx0) nx0 = prevX0
      if (prevY0 < ny0) ny0 = prevY0
      if (prevX1 > nx1) nx1 = prevX1
      if (prevY1 > ny1) ny1 = prevY1
    }
    if (activeCount > 0) {
      prevX0 = curX0
      prevY0 = curY0
      prevX1 = curX1
      prevY1 = curY1
    } else {
      prevX0 = Infinity
    }
    if (!(nx0 < nx1 && ny0 < ny1)) return

    // Every dot whose rest point lies within the box (± its radius, ± the largest offset so moved
    // dots are included); the clip keeps edge dots from being painted twice.
    const reach = pad + MAX_DRAW_OFFSET
    drawRange(rowLo(ny0 - reach), rowHi(ny1 + reach), colLo(nx0 - reach), colHi(nx1 + reach))
    c.save()
    c.beginPath()
    c.rect(nx0, ny0, nx1 - nx0, ny1 - ny0)
    c.clip()
    c.clearRect(nx0, ny0, nx1 - nx0, ny1 - ny0)
    flush(c, false)
    c.restore()
  }

  /** Collects dots in a grid range into `order`, grouped by colour bucket. */
  function drawRange(r0: number, r1: number, c0: number, c1: number): void {
    counts.fill(0)
    drawCount = 0
    for (let r = r0; r <= r1; r++) {
      const base = r * cols
      for (let cc = c0; cc <= c1; cc++) {
        const i = base + cc
        const b = bucketFor(i)
        bucketOf[i] = b
        counts[b]++
        order[drawCount++] = i
      }
    }
    let acc = 0
    for (let b = 0; b < BUCKETS; b++) {
      starts[b] = acc
      acc += counts[b]
    }
    // Stable counting sort into `sorted` by bucket.
    for (let k = 0; k < drawCount; k++) {
      const i = order[k]
      sorted[starts[bucketOf[i]]++] = i
    }
  }

  function flush(c: CanvasRenderingContext2D, lagOn: boolean): void {
    let k = 0
    const size = DOT_R * 2
    for (let b = 0; b < BUCKETS; b++) {
      const cnt = counts[b]
      if (cnt === 0) continue
      c.fillStyle = COLOURS[b]
      c.beginPath()
      const end = k + cnt
      for (; k < end; k++) {
        const i = sorted[k]
        const x = restX[i] + offX[i]
        let y = restY[i] + offY[i]
        if (lagOn) y += rowLag[(i / cols) | 0]
        if (useRects) {
          c.rect(x - DOT_R, y - DOT_R, size, size)
        } else {
          c.moveTo(x + DOT_R, y)
          c.arc(x, y, DOT_R, 0, TAU)
        }
      }
      c.fill()
    }
  }

  // -------------------------------------------------------------------------------------------
  // Quiet rects
  // -------------------------------------------------------------------------------------------

  /** Dots are flagged by rest position but drawn up to pull.amp away, so rects grow by that much:
   *  a tinted dot pulled in from just outside a text block is still capped. */
  function applyQuiet(): void {
    quiet.fill(0, 0, n)
    for (let q = 0; q < quietCount; q++) {
      const o = q * 4
      const r0 = rowLo(quietBuf[o + 1] - QUIET_MARGIN)
      const r1 = rowHi(quietBuf[o + 3] + QUIET_MARGIN)
      const c0 = colLo(quietBuf[o] - QUIET_MARGIN)
      const c1 = colHi(quietBuf[o + 2] + QUIET_MARGIN)
      for (let r = r0; r <= r1; r++) {
        const base = r * cols
        for (let c = c0; c <= c1; c++) quiet[base + c] = 1
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // API
  // -------------------------------------------------------------------------------------------

  function setSize(w: number, h: number, dpr: number): void {
    if (destroyed) return
    const width = Math.max(0, w)
    const height = Math.max(0, h)
    const scale = clamp(dpr || 1, 1, FIELD.dprCap)
    const newCols = width > 0 ? Math.ceil(width / P) + 1 : 0
    const newRows = height > 0 ? Math.ceil(height / P) + 1 : 0
    const newN = newCols * newRows
    // Same column count (e.g. the mobile URL bar showing or hiding): keep the state of
    // existing rows so the trace survives. Otherwise the grid is rebuilt from rest.
    const keep = newCols === cols && n > 0 ? Math.min(n, newN) : 0

    if (newN > cap) grow(Math.ceil(newN * 1.25), keep)

    if (keep === 0) {
      resetDots(0, newN)
      activeCount = 0
      traceCount = 0
      if (dragging) {
        dragging = false
        oldestId = sampleTotal
      }
      pending = false
      tapAlive.fill(0)
    } else {
      if (newN > keep) resetDots(keep, newN)
      // Drop list entries that fell off the bottom.
      for (let a = 0; a < activeCount; ) {
        if (activeList[a] >= newN) activeList[a] = activeList[--activeCount]
        else a++
      }
      for (let k = 0; k < traceCount; ) {
        if (traceList[k] >= newN) traceList[k] = traceList[--traceCount]
        else k++
      }
    }

    cols = newCols
    rows = newRows
    n = newN
    W = width
    H = height
    for (let r = 0; r < rows; r++) {
      const y = HALF + r * P
      const base = r * cols
      for (let c = 0; c < cols; c++) {
        restX[base + c] = HALF + c * P
        restY[base + c] = y
      }
    }
    if (rowLag.length < rows) rowLag = new Float32Array(rows)

    // Resizing the backing store clears it; redraw in the same task so nothing flashes.
    const bw = Math.round(width * scale)
    const bh = Math.round(height * scale)
    if (canvas.width !== bw) canvas.width = bw
    if (canvas.height !== bh) canvas.height = bh
    ctx!.setTransform(scale, 0, 0, scale, 0, 0)
    applyQuiet()
    render(true)
    if (activeCount > 0 || lag !== 0) wake()
  }

  function pointerDown(x: number, y: number): void {
    if (destroyed) return
    isDown = true
    pending = true
    hoverOn = false
    downX = ptrX = x
    downY = ptrY = y
    downT = now()
    wake()
  }

  function pointerMove(x: number, y: number, pointerType: PointerKind, buttons: number): void {
    if (destroyed) return
    if (!isDown) {
      if (pointerType === 'mouse' && buttons === 0 && !reduced) {
        hoverOn = true
        hoverX = x
        hoverY = y
        hoverT = now()
        wake()
      }
      return
    }
    ptrX = x
    ptrY = y
    const t = now()
    if (pending) {
      const dx = x - downX
      const dy = y - downY
      if (dx * dx + dy * dy <= TAP_MAX_MOVE * TAP_MAX_MOVE) return
      startDrag(t)
    } else if (dragging) {
      appendPath(x, y, t)
    }
    wake()
  }

  function pointerUp(x: number, y: number): void {
    if (destroyed || !isDown) return
    const t = now()
    isDown = false
    if (pending) {
      pending = false
      const dx = x - downX
      const dy = y - downY
      if (t - downT <= TAP_MAX_MS && dx * dx + dy * dy <= TAP_MAX_MOVE * TAP_MAX_MOVE) {
        spawnTap(x, y, t)
      }
    } else if (dragging) {
      appendPath(x, y, t)
      endDrag()
    }
    wake()
  }

  function pointerCancel(): void {
    if (destroyed) return
    isDown = false
    pending = false
    if (dragging) endDrag()
    hoverOn = false
    wake()
  }

  function pointerLeave(): void {
    if (destroyed) return
    hoverOn = false
    wake()
  }

  function scroll(dy: number, dtMs: number): void {
    if (destroyed || reduced || dy === 0) return
    const v = dy / (dtMs > 0 ? dtMs : 16)
    lagTarget = clamp(-v * SCROLL_GAIN, -SCROLL_MAX_LAG, SCROLL_MAX_LAG)
    scrollDir = dy > 0 ? 1 : -1
    lastScrollT = now()
    wake()
  }

  function clearTrace(): void {
    if (destroyed) return
    if (dragging) endDrag()
    pending = false
    tapAlive.fill(0)
    const t = now()
    for (let i = 0; i < n; i++) {
      if (tint[i] > 0 || tintMode[i] !== 0) {
        tintFrom[i] = tint[i]
        tintTo[i] = 0
        tintBase[i] = 0
        tintT0[i] = t
        tintDur[i] = CLEAR_FADE_MS
        tintMode[i] = 2
        addActive(i)
      }
    }
    wake()
  }

  function setQuietRects(rects: ArrayLike<QuietRect>): void {
    if (destroyed) return
    const len = rects.length
    if (quietBuf.length < len * 4) quietBuf = new Float32Array(len * 4 + 16)
    for (let q = 0; q < len; q++) {
      const r = rects[q]
      const o = q * 4
      quietBuf[o] = r.left
      quietBuf[o + 1] = r.top
      quietBuf[o + 2] = r.right
      quietBuf[o + 3] = r.bottom
    }
    quietCount = len
    applyQuiet()
    // Only tinted dots look different inside a quiet rect.
    if (anyTint() || activeCount > 0) {
      if (frameId === 0 && !paused) render(true)
      else fullNext = true
    }
  }

  function setReducedMotion(value: boolean): void {
    if (destroyed) return
    reduced = value
    if (value) {
      hoverOn = false
      lag = 0
      lagVel = 0
      lagTarget = 0
      for (let a = 0; a < activeCount; a++) {
        const i = activeList[a]
        offX[i] = 0
        offY[i] = 0
        velX[i] = 0
        velY[i] = 0
      }
      if (frameId === 0 && !paused) render(true)
      else fullNext = true
    }
    wake()
  }

  function setBounce(value: boolean): void {
    bounce = value
    zetaRel = bounce ? FIELD.spring.zetaBounce : FIELD.spring.zetaNoBounce
    omegaRel = omegaFor(RELEASE_MS, zetaRel)
  }

  function pause(): void {
    paused = true
    if (frameId !== 0) {
      cancelFrame(frameId)
      frameId = 0
    }
  }

  function resume(): void {
    if (destroyed) return
    paused = false
    // One frame: it renders and goes back to sleep if nothing is moving.
    wake()
  }

  function destroy(): void {
    if (frameId !== 0) cancelFrame(frameId)
    frameId = 0
    destroyed = true
    n = 0
  }

  function anyTint(): boolean {
    for (let i = 0; i < n; i++) if (tint[i] > 0.0005) return true
    return false
  }

  /** Dots in a tinted colour bucket right now, and the highest bucket. */
  function tintSummary(): [number, number] {
    let k = 0
    let max = 0
    for (let i = 0; i < n; i++) {
      const b = bucketFor(i)
      if (b > 0) k++
      if (b > max) max = b
    }
    return [k, max]
  }

  function getStats(): GravityGridStats {
    const [tinted, maxBucket] = tintSummary()
    let maxOffset = 0
    for (let a = 0; a < activeCount; a++) {
      const i = activeList[a]
      const m = Math.sqrt(offX[i] * offX[i] + offY[i] * offY[i])
      if (m > maxOffset) maxOffset = m
    }
    return {
      dots: n,
      cols,
      rows,
      active: activeCount,
      awake: frameId !== 0,
      frames,
      frameMs,
      rects: useRects,
      maxOffset,
      tinted,
      maxBucket,
    }
  }

  return {
    setSize,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    pointerLeave,
    scroll,
    clearTrace,
    setQuietRects,
    setReducedMotion,
    setBounce,
    pause,
    resume,
    destroy,
    getStats,
  }
}
