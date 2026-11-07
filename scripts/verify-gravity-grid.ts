/**
 * CI gate: Gravity Grid maths and engine (no DOM). Run: npm run test:gravity-grid
 * The engine runs against a fake 2D context, a fake clock and a fake frame queue.
 */
import assert from 'node:assert/strict'
import { FIELD } from '../lib/brand/field'
import {
  brandEase,
  createGravityGrid,
  lens,
  omegaFor,
  pullOffset,
  springStep,
  tint,
  traceStrength,
} from '../lib/brand/gravity-grid'

let passed = 0
function test(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

console.log('Gravity Grid: maths')

test('lens is 0 at d = 0 and peaks at amp when d = sigma', () => {
  const { amp, sigma } = FIELD.pull
  assert.equal(lens(0, amp, sigma), 0)
  assert.ok(Math.abs(lens(sigma, amp, sigma) - amp) < 1e-9)
  let bestD = 0
  let best = -1
  for (let d = 0; d <= 300; d += 0.25) {
    const v = lens(d, amp, sigma)
    if (v > best) {
      best = v
      bestD = d
    }
  }
  assert.ok(Math.abs(bestD - sigma) <= 0.25, `peak at ${bestD}`)
})

test('pull offset never exceeds 0.85 × d or amp, points at the well, is 0 beyond reach', () => {
  const { amp, sigma, reach, maxShareOfDistance } = FIELD.pull
  const out = new Float64Array(2)
  for (let d = 0.1; d < reach + 50; d += 0.7) {
    for (const strength of [0.3, 0.7, 1]) {
      for (let a = 0; a < Math.PI * 2; a += 0.6) {
        const dx = Math.cos(a) * d
        const dy = Math.sin(a) * d
        pullOffset(dx, dy, d, strength, amp, sigma, reach, out)
        const len = Math.hypot(out[0], out[1])
        if (d >= reach) {
          assert.equal(len, 0)
          continue
        }
        assert.ok(len <= maxShareOfDistance * d + 1e-9, `len ${len} > 0.85d at d=${d}`)
        assert.ok(len <= amp + 1e-9, `len ${len} > amp`)
        if (len > 0) assert.ok(out[0] * dx + out[1] * dy > 0, 'points toward the well')
      }
    }
  }
})

test('tint is 1 at the centre with full strength and stays in 0..1', () => {
  assert.equal(tint(0, FIELD.tint.sigma, 1), 1)
  assert.equal(tint(0, FIELD.tint.sigma, 3), 1)
  assert.ok(tint(FIELD.tint.sigma, FIELD.tint.sigma, 1) < 0.61)
  assert.equal(tint(10, FIELD.tint.sigma, 0), 0)
})

test('trace strength falls linearly from 1 to the floor at windowMs, then holds', () => {
  const { windowMs, floor } = FIELD.trace
  assert.equal(traceStrength(0), 1)
  assert.ok(Math.abs(traceStrength(windowMs / 2) - (1 + floor) / 2) < 1e-9)
  assert.equal(traceStrength(windowMs), floor)
  assert.equal(traceStrength(windowMs * 5), floor)
})

/** Step response from 1 to 0. Returns min x and the last time |x| was above each band. */
function release(zeta: number, settleMs: number, dt: number) {
  const omega = omegaFor(settleMs, zeta)
  const out = new Float64Array(2)
  let x = 1
  let v = 0
  let minX = 1
  // Visible overshoots: swings past the target (after the first) that peak above 1% of the start.
  let crossings = 0
  let swing = 0
  let peak = 0
  let sign = 1
  const lastAbove = { b1: 0, b5: 0 }
  for (let t = 0; t < settleMs * 4; t += dt * 1000) {
    springStep(x, v, 0, dt, omega, zeta, out)
    x = out[0]
    v = out[1]
    assert.ok(Number.isFinite(x) && Math.abs(x) < 10, 'spring stays bounded')
    if (x < minX) minX = x
    const s = x < 0 ? -1 : 1
    if (s !== sign) {
      if (swing > 0 && peak > 0.01) crossings++
      swing++
      peak = 0
      sign = s
    }
    if (Math.abs(x) > peak) peak = Math.abs(x)
    if (Math.abs(x) > 0.01) lastAbove.b1 = t
    if (Math.abs(x) > 0.05) lastAbove.b5 = t
  }
  if (swing > 0 && peak > 0.01) crossings++
  return { minX, crossings, lastAbove, end: x }
}

test('zeta 1.0 never overshoots and settles near release ms', () => {
  const r = release(FIELD.spring.zetaNoBounce, FIELD.time.release, 1 / 240)
  assert.ok(r.minX >= -1e-9, `overshoot ${r.minX}`)
  // Critically damped, omega = 4.6 / T: inside 5% at T (within ±10%).
  const T = FIELD.time.release
  assert.ok(r.lastAbove.b5 >= T * 0.9 && r.lastAbove.b5 <= T * 1.1, `5% at ${r.lastAbove.b5}ms`)
})

test('zeta 0.62 overshoots once by under 15% and settles within release ms', () => {
  const r = release(FIELD.spring.zetaBounce, FIELD.time.release, 1 / 240)
  assert.equal(r.crossings, 1, `crossings ${r.crossings}`)
  assert.ok(-r.minX > 0 && -r.minX < 0.15, `overshoot ${-r.minX}`)
  // Inside 1% by T + 10%. (It gets there at about 0.85 T.)
  assert.ok(r.lastAbove.b1 <= FIELD.time.release * 1.1, `1% at ${r.lastAbove.b1}ms`)
})

test('springStep is stable at dt = 1/30 s for the stiff touch-in spring', () => {
  for (const zeta of [1, FIELD.spring.zetaBounce]) {
    const r = release(zeta, FIELD.time.touchIn, 1 / 30)
    assert.ok(Math.abs(r.end) < 1e-3, `ends at ${r.end}`)
  }
})

test('brand ease runs 0 → 1, monotonic, ease-out shaped', () => {
  assert.equal(brandEase(0), 0)
  assert.equal(brandEase(1), 1)
  let prev = 0
  for (let t = 0.01; t < 1; t += 0.01) {
    const y = brandEase(t)
    assert.ok(y >= prev - 1e-9, 'monotonic')
    assert.ok(y >= t - 1e-9, 'ease-out sits above linear')
    prev = y
  }
})

// -------------------------------------------------------------------------------------------
// Engine harness
// -------------------------------------------------------------------------------------------

console.log('Gravity Grid: engine')

const REST_R = parseInt(FIELD.colours.rest.slice(1, 3), 16)

function harness(opts: { reducedMotion?: boolean; bounce?: boolean } = {}) {
  let clock = 1000
  let queue: Array<(t: number) => void> = []
  let maxBucket = 0
  let frameRequests = 0
  let arcs = 0
  const ctx = {
    clearRect() {
      maxBucket = 0
    },
    setTransform() {},
    save() {},
    restore() {},
    clip() {},
    beginPath() {},
    moveTo() {},
    arc() {
      arcs++
    },
    rect() {},
    fill() {},
    set fillStyle(v: string) {
      const r = Number(/rgb\((\d+)/.exec(v)?.[1] ?? REST_R)
      const b = Math.round(((REST_R - r) / REST_R) * (FIELD.tint.buckets - 1))
      if (b > maxBucket) maxBucket = b
    },
  } as unknown as CanvasRenderingContext2D
  const canvas = { width: 0, height: 0 } as HTMLCanvasElement
  const grid = createGravityGrid(canvas, {
    ...opts,
    context: ctx,
    now: () => clock,
    requestFrame: (cb) => {
      frameRequests++
      queue.push(cb)
      return queue.length
    },
    cancelFrame: () => {
      queue = []
    },
  })
  assert.ok(grid)
  const frame = (ms = 16) => {
    clock += ms
    const q = queue
    queue = []
    for (const cb of q) cb(clock)
  }
  const runUntilAsleep = (limitMs: number) => {
    let elapsed = 0
    while (queue.length > 0 && elapsed < limitMs) {
      frame(16)
      elapsed += 16
    }
    return elapsed
  }
  const drag = (x0: number, y0: number, x1: number, y1: number, steps = 20) => {
    grid.pointerDown(x0, y0, 'touch')
    for (let k = 1; k <= steps; k++) {
      frame(16)
      grid.pointerMove(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, 'touch', 1)
    }
    frame(16)
  }
  return {
    grid,
    canvas,
    frame,
    runUntilAsleep,
    drag,
    pending: () => queue.length,
    /** Highest colour bucket on the grid right now (from the engine; partial redraws only paint a box). */
    maxBucket: () => grid.getStats().maxBucket,
    /** Highest bucket painted in the most recent frame. */
    paintedBucket: () => maxBucket,
    frameRequests: () => frameRequests,
    /** Dots drawn since the last reset. */
    arcs: () => arcs,
    resetArcs: () => {
      arcs = 0
    },
    advance: (ms: number) => {
      clock += ms
    },
  }
}

test('setSize builds the grid at 12px pitch plus a pitch of margin; dpr capped at 2', () => {
  const h = harness()
  h.grid.setSize(390, 844, 3)
  const s = h.grid.getStats()
  assert.equal(s.cols, Math.ceil(390 / 12) + 1)
  assert.equal(s.rows, Math.ceil(844 / 12) + 1)
  assert.equal(h.canvas.width, 780)
  assert.equal(h.canvas.height, 1688)
  assert.equal(h.pending(), 0, 'no frame requested at rest')
})

test('drag pulls dots (within amp), tints the trace, then settles and sleeps', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  h.drag(60, 400, 330, 400)
  let s = h.grid.getStats()
  assert.ok(s.maxOffset > 1, `held offset ${s.maxOffset}`)
  assert.ok(s.maxOffset <= FIELD.pull.amp + 0.5, `held offset ${s.maxOffset}`)
  assert.ok(h.maxBucket() >= 10, `trace bucket ${h.maxBucket()}`)
  h.grid.pointerUp(330, 400)
  const took = h.runUntilAsleep(10_000)
  s = h.grid.getStats()
  assert.equal(h.pending(), 0, 'asleep')
  assert.ok(took <= FIELD.time.traceFade + 600, `slept after ${took}ms`)
  assert.equal(s.active, 0)
  assert.equal(s.maxOffset, 0)
  // The trace holds at traceRest × peak.
  const restBucket = Math.round(Math.pow(FIELD.tint.traceRest, FIELD.tint.gamma) * (FIELD.tint.buckets - 1))
  assert.ok(h.maxBucket() >= 1 && h.maxBucket() <= restBucket, `rest bucket ${h.maxBucket()}`)
  assert.ok(s.tinted > 0)
})

test('idle: no frames requested once settled, and input wakes it', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  const before = h.frameRequests()
  h.advance(5000)
  assert.equal(h.frameRequests(), before)
  h.grid.pointerMove(100, 100, 'mouse', 0)
  assert.equal(h.pending(), 1)
  // Hover springs home after idleMs and the loop sleeps again.
  const took = h.runUntilAsleep(10_000)
  assert.ok(took < FIELD.hover.idleMs + 2500, `hover slept after ${took}ms`)
})

test('tap: tight well with full tint at the centre, then fades to rest and sleeps', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  h.grid.pointerDown(200, 300, 'touch')
  h.advance(80)
  h.grid.pointerUp(201, 300)
  for (let k = 0; k < 10; k++) h.frame(16)
  const s = h.grid.getStats()
  assert.ok(s.maxOffset > 0.5 && s.maxOffset <= FIELD.tap.amp + 0.5, `tap offset ${s.maxOffset}`)
  assert.ok(h.maxBucket() >= FIELD.tint.buckets - 3, `tap bucket ${h.maxBucket()}`)
  h.runUntilAsleep(10_000)
  assert.equal(h.pending(), 0)
})

test('reduced motion: nothing moves; drag and tap still tint', () => {
  const h = harness({ reducedMotion: true })
  h.grid.setSize(390, 844, 2)
  h.grid.pointerMove(100, 100, 'mouse', 0)
  h.grid.scroll(40, 16)
  h.drag(60, 400, 330, 400)
  assert.equal(h.grid.getStats().maxOffset, 0)
  assert.ok(h.maxBucket() >= 10)
  h.grid.pointerUp(330, 400)
  h.grid.pointerDown(200, 200, 'touch')
  h.advance(50)
  h.grid.pointerUp(200, 200)
  h.frame(16)
  assert.equal(h.grid.getStats().maxOffset, 0)
  assert.ok(h.maxBucket() >= FIELD.tint.buckets - 2, `reduced tap bucket ${h.maxBucket()}`)
  h.runUntilAsleep(10_000)
  assert.equal(h.pending(), 0)
})

test('clearTrace fades every tint to 0 within clearFade, then sleeps', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  h.drag(60, 400, 330, 400)
  h.grid.pointerUp(330, 400)
  h.runUntilAsleep(10_000)
  assert.ok(h.grid.getStats().tinted > 0)
  h.grid.clearTrace()
  const took = h.runUntilAsleep(10_000)
  assert.ok(took <= FIELD.time.clearFade + 50, `cleared after ${took}ms`)
  assert.equal(h.grid.getStats().tinted, 0)
})

test('quiet rects cap tint at capQuiet', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  h.grid.setQuietRects([{ left: 0, top: 0, right: 390, bottom: 844 }])
  h.drag(60, 400, 330, 400)
  const capBucket = Math.round(Math.pow(FIELD.tint.capQuiet, FIELD.tint.gamma) * (FIELD.tint.buckets - 1))
  assert.ok(h.maxBucket() <= capBucket, `bucket ${h.maxBucket()} > ${capBucket}`)
  assert.ok(h.maxBucket() >= 1)
})

test('scroll lags dots near the leading edge, then settles', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  for (let k = 0; k < 5; k++) {
    h.grid.scroll(30, 16)
    h.frame(16)
  }
  assert.ok(h.pending() > 0)
  const took = h.runUntilAsleep(5000)
  assert.ok(took < 1500, `scroll settled after ${took}ms`)
})

test('bounce on: release overshoot stays within maxOvershoot', () => {
  const h = harness({ bounce: true })
  h.grid.setSize(390, 844, 2)
  h.drag(60, 400, 330, 400)
  h.grid.pointerUp(330, 400)
  // maxOffset after the first ~250ms is the overshoot side of the swing.
  let worst = 0
  for (let k = 0; k < 120; k++) {
    h.frame(16)
    if (k > 30) worst = Math.max(worst, h.grid.getStats().maxOffset)
  }
  assert.ok(worst <= FIELD.spring.maxOvershoot + 0.05, `overshoot ${worst}`)
})

test('pause stops the loop; resume renders one frame and sleeps', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  h.grid.pointerDown(100, 100, 'touch')
  assert.equal(h.pending(), 1)
  h.grid.pause()
  assert.equal(h.pending(), 0)
  h.grid.pointerMove(200, 200, 'touch', 1)
  assert.equal(h.pending(), 0, 'no frames while paused')
  h.grid.pointerCancel()
  h.grid.resume()
  h.runUntilAsleep(5000)
  assert.equal(h.pending(), 0)
})

test('resize keeps the trace when only the height changes; rebuilds when width changes', () => {
  const h = harness()
  h.grid.setSize(390, 844, 2)
  h.drag(60, 400, 330, 400)
  h.grid.pointerUp(330, 400)
  h.runUntilAsleep(10_000)
  const tinted = h.grid.getStats().tinted
  h.grid.setSize(390, 760, 2)
  assert.equal(h.grid.getStats().tinted, tinted, 'URL-bar resize keeps the trace')
  h.grid.setSize(844, 390, 2)
  assert.equal(h.grid.getStats().tinted, 0, 'rotate rebuilds from rest')
  assert.equal(h.pending(), 0)
})

test('a tap redraws only the dirty box, not the whole grid', () => {
  const h = harness()
  h.grid.setSize(1440, 900, 2)
  const total = h.grid.getStats().dots
  h.grid.pointerDown(700, 450, 'mouse')
  h.advance(60)
  h.grid.pointerUp(700, 450)
  h.frame(16)
  h.resetArcs()
  h.frame(16)
  assert.ok(h.arcs() > 0 && h.arcs() < total / 10, `drew ${h.arcs()} of ${total} dots`)
})

console.log(`\nGravity Grid: ${passed} passed`)
