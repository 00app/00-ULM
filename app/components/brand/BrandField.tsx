'use client'

/**
 * Where the Gravity Grid runs. Mounted once in app/layout.tsx, beside InteractiveBackground and
 * outside the app shell. The canvas portals to <body> at z-index 0, so the stack is:
 * `.zz-background-env` (flat ground, z 0) → Gravity Grid canvas (z 0, later in the DOM) →
 * app shell (z 1) → portalled nav, sheets and overlays (above the shell) → boot logo (z 150).
 *
 * - Website (front door) and app routes: onboarding, Zone (and Card focus), Ask Zai, Likes,
 *   Agents, Settings.
 * - While any modal or bottom sheet is open (`[aria-modal="true"]`), the trace is cleared and
 *   the field is disabled, so nothing moves behind the overlay.
 * - Liquid page-enter on a route change holds the field for the enter duration
 *   (lib/brand/fieldHold.ts); the card ↔ Solo Focus morph holds it from ExpandedCardShell.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import GravityGrid, { type GravityGridHandle } from '@/app/components/brand/GravityGrid'
import { holdField } from '@/lib/brand/fieldHold'
import { DUR } from '@/lib/motion'
import { ROUTES } from '@/lib/routes'

const EXACT = new Set<string>([ROUTES.HOME, ROUTES.FRONT_DOOR])
const PREFIXES = [
  ROUTES.START,
  ROUTES.PROFILE,
  ROUTES.ZONE,
  ROUTES.ZAI,
  ROUTES.LIKES,
  ROUTES.SETTINGS,
  '/agents',
] as const

const OVERLAY_SELECTOR = '[aria-modal="true"]'
/** Page-enter (DUR.enter) plus a frame or two of margin. */
const PAGE_ENTER_HOLD_MS = Math.round(DUR.enter * 1000) + 40

function normalise(p: string | null): string {
  const raw = (p ?? '').trim()
  if (!raw || raw === '/') return '/'
  return raw.replace(/\/+$/, '') || '/'
}

export function fieldRunsOn(path: string): boolean {
  if (EXACT.has(path)) return true
  return PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

export default function BrandField() {
  const path = normalise(usePathname())
  const on = fieldRunsOn(path)
  const gridRef = useRef<GravityGridHandle>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const firstPath = useRef(true)

  // Modals and bottom sheets: watch for any aria-modal element (sheets portal to <body>).
  useEffect(() => {
    if (!on) return
    let raf = 0
    const check = () => {
      raf = 0
      setOverlayOpen(document.querySelector(OVERLAY_SELECTOR) !== null)
    }
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(check)
    }
    check()
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] })
    return () => {
      mo.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [on])

  useEffect(() => {
    if (overlayOpen) gridRef.current?.clearTrace()
  }, [overlayOpen])

  // Route change: the Liquid page-enter plays, so hold the field for its duration.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false
      return
    }
    holdField(PAGE_ENTER_HOLD_MS)
  }, [path])

  if (!on) return null
  return <GravityGrid ref={gridRef} enabled={!overlayOpen} />
}
