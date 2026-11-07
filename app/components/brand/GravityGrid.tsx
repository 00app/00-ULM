'use client'

/**
 * Gravity Grid: the brand background field (docs/BRAND-LANGUAGE.md). A thin React shell around
 * the framework-free engine in lib/brand/gravity-grid.
 *
 * The canvas is portalled to <body> so it is always fixed to the viewport, whatever it is
 * mounted inside (the app shell has `perspective`, which would otherwise trap a fixed child).
 * It stacks at z-index 0 after `.zz-background-env` (flat ground, z 0) and under the app shell
 * (z 1). It never takes input: pointer-events none, passive listeners, no preventDefault, no
 * touch-action.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { FIELD } from '@/lib/brand/field'
import { subscribeFieldHold } from '@/lib/brand/fieldHold'
import { createGravityGrid, type GravityGrid as Engine, type GravityGridStats } from '@/lib/brand/gravity-grid'

export interface GravityGridProps {
  /** False pauses the field and ignores input (e.g. while a modal or sheet is open). */
  enabled?: boolean
  /** Defaults to FIELD.spring.bounce (off: the brand rules out bounce). */
  bounce?: boolean
}

export interface GravityGridHandle {
  clearTrace(): void
  getStats(): GravityGridStats | null
}

const QUIET_SELECTOR = '[data-field-quiet]'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

const GravityGrid = forwardRef<GravityGridHandle, GravityGridProps>(function GravityGrid(
  { enabled = true, bounce = FIELD.spring.bounce },
  ref,
) {
  const [mounted, setMounted] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const enabledRef = useRef(enabled)
  /** Resumes the engine unless disabled, hidden or held by a Liquid transition. */
  const resumeRef = useRef<(() => void) | null>(null)
  const pathname = usePathname()
  const firstPath = useRef(true)

  useImperativeHandle(
    ref,
    () => ({
      clearTrace: () => engineRef.current?.clearTrace(),
      getStats: () => engineRef.current?.getStats() ?? null,
    }),
    [],
  )

  useEffect(() => setMounted(true), [])

  // Engine + listeners
  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const mq = window.matchMedia(REDUCED_QUERY)
    const engine = createGravityGrid(canvas, { reducedMotion: mq.matches, bounce })
    if (!engine) {
      setUnsupported(true)
      return
    }
    engineRef.current = engine

    const size = () => engine.setSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1)
    size()

    // Quiet rects: one read per animation frame at most.
    let quietRaf = 0
    const readQuiet = () => {
      quietRaf = 0
      const vh = window.innerHeight
      const vw = window.innerWidth
      const rects: DOMRect[] = []
      document.querySelectorAll(QUIET_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0) rects.push(r)
      })
      engine.setQuietRects(rects)
    }
    const scheduleQuiet = () => {
      if (!quietRaf) quietRaf = window.requestAnimationFrame(readQuiet)
    }
    readQuiet()

    const live = () => enabledRef.current && !document.hidden

    // Only the primary pointer draws; a second finger is ignored.
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary || !live()) return
      engine.pointerDown(e.clientX, e.clientY, e.pointerType)
    }
    const onMove = (e: PointerEvent) => {
      if (!e.isPrimary || !live()) return
      engine.pointerMove(e.clientX, e.clientY, e.pointerType, e.buttons)
    }
    const onUp = (e: PointerEvent) => {
      if (!e.isPrimary) return
      engine.pointerUp(e.clientX, e.clientY)
    }
    // The browser took the gesture (usually a scroll): drop the trace, let scroll take over.
    const onCancel = (e: PointerEvent) => {
      if (!e.isPrimary) return
      engine.pointerCancel()
    }
    const onLeave = () => engine.pointerLeave()

    // Scroll from the window or any scrolling element (Zai scrolls inside a panel).
    let lastWinY = window.scrollY
    let lastWinT = performance.now()
    const elScroll = new WeakMap<Element, { top: number; t: number }>()
    const onScroll = (e: Event) => {
      scheduleQuiet()
      if (!live()) return
      const t = performance.now()
      const target = e.target
      if (target === document || target === document.documentElement || target === window) {
        const y = window.scrollY
        engine.scroll(y - lastWinY, t - lastWinT)
        lastWinY = y
        lastWinT = t
      } else if (target instanceof Element) {
        const prev = elScroll.get(target)
        const top = target.scrollTop
        if (prev) engine.scroll(top - prev.top, t - prev.t)
        elScroll.set(target, { top, t })
      }
    }

    // ResizeObserver fires after layout and before paint, so resizing (and redrawing) the backing
    // store there means the browser never shows a stretched or blank frame on resize or rotate.
    let resizeRaf = 0
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            size()
            scheduleQuiet()
          })
        : null
    ro?.observe(canvas)
    const onResize = () => {
      scheduleQuiet()
      if (ro || resizeRaf) return
      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0
        size()
      })
    }

    // Dev only: QA and the Playwright spec read engine stats from here.
    const debugWindow = window as Window & { __gravityGrid?: Engine }
    if (process.env.NODE_ENV !== 'production') debugWindow.__gravityGrid = engine

    // Liquid transitions hold the field (lib/brand/fieldHold.ts): pause, then resume when the
    // longest hold ends. Input still lands in the engine and plays out after.
    let holdTimer = 0
    let held = false
    const canRun = () => enabledRef.current && !document.hidden && !held
    const onHold = (until: number) => {
      held = true
      engine.pause()
      window.clearTimeout(holdTimer)
      holdTimer = window.setTimeout(() => {
        held = false
        if (canRun()) engine.resume()
      }, Math.max(0, until - performance.now()))
    }
    const unsubscribeHold = subscribeFieldHold(onHold)
    resumeRef.current = () => {
      if (canRun()) engine.resume()
    }

    const onVisibility = () => {
      if (document.hidden) engine.pause()
      else if (canRun()) engine.resume()
    }
    const onReduced = () => engine.setReducedMotion(mq.matches)

    const passive = { passive: true } as const
    window.addEventListener('pointerdown', onDown, passive)
    window.addEventListener('pointermove', onMove, passive)
    window.addEventListener('pointerup', onUp, passive)
    window.addEventListener('pointercancel', onCancel, passive)
    window.addEventListener('blur', onLeave, passive)
    document.addEventListener('mouseleave', onLeave, passive)
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onResize, passive)
    document.addEventListener('visibilitychange', onVisibility)
    mq.addEventListener('change', onReduced)
    if (document.hidden || !enabledRef.current) engine.pause()

    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      mq.removeEventListener('change', onReduced)
      ro?.disconnect()
      unsubscribeHold()
      window.clearTimeout(holdTimer)
      resumeRef.current = null
      if (quietRaf) window.cancelAnimationFrame(quietRaf)
      if (resizeRaf) window.cancelAnimationFrame(resizeRaf)
      if (debugWindow.__gravityGrid === engine) delete debugWindow.__gravityGrid
      engine.destroy()
      engineRef.current = null
    }
    // bounce is applied live below; the engine is built once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  useEffect(() => {
    engineRef.current?.setBounce(bounce)
  }, [bounce])

  useEffect(() => {
    enabledRef.current = enabled
    const engine = engineRef.current
    if (!engine) return
    if (enabled) {
      resumeRef.current?.()
    } else {
      engine.pointerCancel()
      engine.pause()
    }
  }, [enabled])

  // New route: the old trace fades out, and the quiet text blocks are different.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false
      return
    }
    const engine = engineRef.current
    if (!engine) return
    engine.clearTrace()
    const raf = window.requestAnimationFrame(() => {
      const rects: DOMRect[] = []
      document.querySelectorAll(QUIET_SELECTOR).forEach((el) => rects.push(el.getBoundingClientRect()))
      engine.setQuietRects(rects)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [pathname])

  if (!mounted || unsupported) return null

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="zz-gravity-grid"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />,
    document.body,
  )
})

export default GravityGrid
