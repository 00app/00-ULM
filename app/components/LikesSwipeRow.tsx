'use client'

import { animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useRef, type PointerEvent, type ReactNode } from 'react'

const REMOVE_AT_PX = 96
const EASE = [0.22, 1, 0.36, 1] as const

type Props = {
  children: ReactNode
  onRemove: () => void
  /** While likes are still loading, Remove (a server toggle) must wait — swipe does too. */
  disabled?: boolean
}

/**
 * Phone gesture for the Likes wall: swipe a card left past REMOVE_AT_PX to remove it (the page's
 * own Remove + Undo flow). Touch only — mouse and pen keep plain clicks — and vertical scrolling
 * is left to the browser (touch-action: pan-y). A swipe never also counts as a tap-to-open.
 */
export function LikesSwipeRow({ children, onRemove, disabled = false }: Props) {
  const controls = useDragControls()
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const hintOpacity = useTransform(x, [-REMOVE_AT_PX, -24, 0], [1, 0.4, 0])
  const draggedRef = useRef(false)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggedRef.current = false
    if (disabled || e.pointerType !== 'touch') return
    if ((e.target as HTMLElement).closest('button, a')) return
    controls.start(e)
  }

  return (
    <div className="likes-swipe">
      <motion.span className="likes-swipe__hint zzb-meta" aria-hidden style={{ opacity: hintOpacity }}>
        Remove
      </motion.span>
      <motion.div
        className="likes-swipe__body"
        style={{ x }}
        drag="x"
        dragControls={controls}
        dragListener={false}
        dragDirectionLock
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        dragMomentum={false}
        onPointerDown={onPointerDown}
        onDragStart={() => {
          draggedRef.current = true
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x <= -REMOVE_AT_PX) {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8)
            onRemove()
            x.set(0)
            return
          }
          void animate(x, 0, reduceMotion ? { duration: 0 } : { duration: 0.3, ease: EASE })
        }}
        onClickCapture={(e) => {
          // The click that ends a swipe must not open the card.
          if (draggedRef.current) {
            e.stopPropagation()
            e.preventDefault()
            draggedRef.current = false
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
