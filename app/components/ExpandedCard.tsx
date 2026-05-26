'use client'

/**
 * RAMS expanded Solo Focus portal shell — open/close timing decoupled from generic zip tokens.
 * Used by {@link JourneyBentoCard} and {@link SoloFocusOverlay} for `.expanded-solo-focus`.
 */
import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import {
  EXPANDED_CARD_CLOSE_TRANSITION,
  EXPANDED_CARD_EXIT_COORDS,
  ZIP_OPEN_Z_INITIAL,
  ZIP_OPEN_Z_ANIMATE,
} from '@/lib/animations'
import { FAMILY_LAYOUT_SPRING, FAMILY_TRANSITION_ATOMIC } from '@/lib/motion-family'

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
        animate={
          isExiting
            ? { opacity: 0, scale: 0.96, filter: 'blur(10px)' }
            : { opacity: 1, scale: 1, filter: 'blur(0px)' }
        }
        exit={{
          ...EXPANDED_CARD_EXIT_COORDS,
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

  return (
    <motion.div
      ref={ref}
      initial={skipInitialSlam ? false : ZIP_OPEN_Z_INITIAL}
      animate={isExiting ? EXPANDED_CARD_EXIT_COORDS : ZIP_OPEN_Z_ANIMATE}
      exit={{
        ...EXPANDED_CARD_EXIT_COORDS,
        transition: EXPANDED_CARD_CLOSE_TRANSITION,
      }}
      transition={isExiting ? EXPANDED_CARD_CLOSE_TRANSITION : FAMILY_TRANSITION_ATOMIC}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
