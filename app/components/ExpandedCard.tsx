'use client'

/**
 * RAMS expanded Solo Focus portal shell — open/close timing decoupled from generic zip tokens.
 * Used by {@link JourneyBentoCard} and {@link SoloFocusOverlay} for `.expanded-solo-focus`.
 */
import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import {
  EXPANDED_CARD_CLOSE_TRANSITION,
  EXPANDED_CARD_OPEN_TRANSITION,
  EXPANDED_CARD_EXIT_COORDS,
  ZIP_OPEN_Z_INITIAL,
  ZIP_OPEN_Z_ANIMATE,
} from '@/lib/animations'

export type ExpandedCardShellProps = Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'transition' | 'exit'> & {
  reduceMotion: boolean
  /** JourneyBentoCard drives close via this flag + onAnimationComplete. */
  isExiting?: boolean
  skipInitialSlam?: boolean
}

export const ExpandedCardShell = forwardRef<HTMLDivElement, ExpandedCardShellProps>(function ExpandedCardShell(
  { reduceMotion, isExiting = false, skipInitialSlam = false, children, ...rest },
  ref
) {
  if (reduceMotion) {
    return (
      <motion.div
        ref={ref}
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
  return (
    <motion.div
      ref={ref}
      initial={skipInitialSlam ? false : ZIP_OPEN_Z_INITIAL}
      animate={isExiting ? EXPANDED_CARD_EXIT_COORDS : ZIP_OPEN_Z_ANIMATE}
      exit={{
        ...EXPANDED_CARD_EXIT_COORDS,
        transition: EXPANDED_CARD_CLOSE_TRANSITION,
      }}
      transition={isExiting ? EXPANDED_CARD_CLOSE_TRANSITION : EXPANDED_CARD_OPEN_TRANSITION}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
