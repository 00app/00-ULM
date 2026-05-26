'use client'

/**
 * RAMS expanded Solo Focus portal shell — open/close timing decoupled from generic zip tokens.
 * Used by {@link JourneyBentoCard} and {@link SoloFocusOverlay} for `.expanded-solo-focus`.
 */
import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { EXPANDED_CARD_CLOSE_TRANSITION } from '@/lib/animations'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_EXIT,
  FAMILY_LAYOUT_SPRING,
  FAMILY_TRANSITION_ATOMIC,
  familyAtomicProps,
} from '@/lib/motion-family'

export type ExpandedCardShellProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'transition' | 'exit'> & {
  reduceMotion: boolean
  /** JourneyBentoCard drives close via this flag + onAnimationComplete. */
  isExiting?: boolean
  skipInitialSlam?: boolean
  /** Shared with collapsed bento cell for liquid morph. */
  layoutId?: string
}

export const ExpandedCardShell = forwardRef<HTMLDivElement, ExpandedCardShellProps>(function ExpandedCardShell(
  { reduceMotion, isExiting = false, skipInitialSlam = false, layoutId, children, ...rest },
  ref
) {
  const useLayoutMorph = Boolean(layoutId) && !reduceMotion

  if (reduceMotion) {
    return (
      <motion.div
        ref={ref}
        layoutId={layoutId}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        transition={{ duration: 0.12 }}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }

  if (useLayoutMorph) {
    return (
      <motion.div
        ref={ref}
        layoutId={layoutId}
        layout
        initial={false}
        animate={isExiting ? FAMILY_ATOMIC_SURFACE_EXIT : FAMILY_ATOMIC_SURFACE_ANIMATE}
        exit={{
          ...FAMILY_ATOMIC_SURFACE_EXIT,
          transition: EXPANDED_CARD_CLOSE_TRANSITION,
        }}
        transition={{
          layout: FAMILY_LAYOUT_SPRING,
          default: isExiting ? EXPANDED_CARD_CLOSE_TRANSITION : FAMILY_TRANSITION_ATOMIC,
        }}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }

  const atomic = familyAtomicProps(false)
  return (
    <motion.div
      ref={ref}
      initial={skipInitialSlam ? false : atomic.initial}
      animate={isExiting ? atomic.exit : atomic.animate}
      exit={{
        ...atomic.exit,
        transition: EXPANDED_CARD_CLOSE_TRANSITION,
      }}
      transition={isExiting ? EXPANDED_CARD_CLOSE_TRANSITION : FAMILY_TRANSITION_ATOMIC}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
