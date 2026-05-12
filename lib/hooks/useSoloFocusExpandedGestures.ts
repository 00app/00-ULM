'use client'

import { useCallback, useRef, type RefObject } from 'react'

const MIN_PAN = 56
const RATIO = 1.15

function targetIsInteractive(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false
  return !!el.closest(
    'button,a,input,textarea,select,[role="button"],[data-solo-focus-no-swipe]',
  )
}

export interface SoloFocusExpandedGesturesOptions {
  scrollRef: RefObject<HTMLElement | null>
  onSwipeToNewer?: () => void
  onSwipeToOlder?: () => void
  onSwipeUpDismiss?: () => void
  onSwipeDownNextJourney?: () => void
  /** When false, only scroll / taps apply */
  enabled?: boolean
}

/**
 * Mobile-first pan gestures for Solo Focus: horizontal = morph pager, vertical at scroll top = dismiss / next journey.
 */
export function useSoloFocusExpandedGestures({
  scrollRef,
  onSwipeToNewer,
  onSwipeToOlder,
  onSwipeUpDismiss,
  onSwipeDownNextJourney,
  enabled = true,
}: SoloFocusExpandedGesturesOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const interactiveRef = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return
      const t = e.touches[0]
      if (!t) return
      interactiveRef.current = targetIsInteractive(e.target)
      startRef.current = { x: t.clientX, y: t.clientY }
    },
    [enabled],
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || interactiveRef.current) {
        startRef.current = null
        interactiveRef.current = false
        return
      }
      const start = startRef.current
      startRef.current = null
      interactiveRef.current = false
      if (!start) return
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)

      const scrollTop = scrollRef.current?.scrollTop ?? 0
      const atTop = scrollTop <= 8

      if (ax > ay * RATIO && ax >= MIN_PAN) {
        if (dx < 0) onSwipeToNewer?.()
        else onSwipeToOlder?.()
        return
      }

      if (atTop && ay > ax * RATIO && ay >= MIN_PAN) {
        if (dy < 0) onSwipeUpDismiss?.()
        else onSwipeDownNextJourney?.()
      }
    },
    [
      enabled,
      scrollRef,
      onSwipeToNewer,
      onSwipeToOlder,
      onSwipeUpDismiss,
      onSwipeDownNextJourney,
    ],
  )

  return { onTouchStart, onTouchEnd }
}
