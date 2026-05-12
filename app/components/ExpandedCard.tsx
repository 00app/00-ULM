'use client'

/**
 * RAMS expanded Solo Focus portal shell — open/close timing decoupled from generic zip tokens.
 * Used by {@link JourneyBentoCard} and {@link SoloFocusOverlay} for `.expanded-solo-focus`.
 */
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
  /** JourneyBentoCard drives close via this flag + onAnimationComplete (not AnimatePresence exit). */
  isExiting?: boolean
  skipInitialSlam?: boolean
}

export function ExpandedCardShell({
  reduceMotion,
  isExiting = false,
  skipInitialSlam = false,
  children,
  ...rest
}: ExpandedCardShellProps) {
  if (reduceMotion) {
    return (
      <motion.div
        initial={false}
        animate={{ opacity: 1, scale: 1, z: 0, rotateX: 0 }}
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
}
