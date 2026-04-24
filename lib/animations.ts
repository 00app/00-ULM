/**
 * Zero Zero Kinetic Logic — single source of truth.
 * Three core behaviors: Slam (data), Bloom (layout/cards), Tap (CTAs).
 */

// =============================================================================
// CORE SPRINGS
// =============================================================================

/** Unified Damped Slam spring — Intro, Onboarding, Solo Focus, Summary word beats */
export const SLAM_SPRING = { type: 'spring' as const, stiffness: 450, damping: 32, mass: 1 }

/** Fluid expansion for cards, layouts, page transitions */
export const INSTANT_BLOOM = { type: 'spring' as const, stiffness: 550, damping: 32, mass: 1 }
export const SPRING_BLOOM = INSTANT_BLOOM

// =============================================================================
// DAMPED SLAM — Intro · Onboarding · Solo Focus · Summary
// =============================================================================

export const DAMPED_SLAM_INITIAL = { scale: 1.08, opacity: 0 }
export const DAMPED_SLAM_ANIMATE = { scale: 1, opacity: 1 }
export const DAMPED_SLAM_EXIT = { scale: 0.96, opacity: 0 }

export const SLAM_INTRO_INITIAL = DAMPED_SLAM_INITIAL
export const SLAM_INTRO_ANIMATE = DAMPED_SLAM_ANIMATE
export const SLAM_INTRO_EXIT = DAMPED_SLAM_EXIT

/** Props for `motion.div` (AnimatePresence) — respects reduced motion. */
export function soloFocusSlamMotionProps(reduceMotion: boolean, skipInitialSlam: boolean) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.12 } },
      transition: { duration: 0.12 },
    }
  }
  return {
    initial: skipInitialSlam ? (false as const) : { scale: 1.05, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { type: 'spring' as const, stiffness: 500, damping: 30, mass: 1 },
  }
}

export const SPRING_TAP = { type: 'spring' as const, stiffness: 620, damping: 24, mass: 0.45 }

// =============================================================================
// DURATIONS
// =============================================================================

export const KINETIC_WORD_DWELL_MS = 400

// =============================================================================
// PRESETS
// =============================================================================

export const FADE_IN_UP = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: SPRING_BLOOM,
}

export const WORD_APPEAR = {
  initial: DAMPED_SLAM_INITIAL,
  animate: DAMPED_SLAM_ANIMATE,
  exit: DAMPED_SLAM_EXIT,
  transition: SLAM_SPRING,
}

export const WORD_PULSE_APPEAR = {
  initial: { opacity: 0, scale: 1.2 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 500, damping: 35, mass: 1 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const },
  },
} as const

// =============================================================================
// ZONE
// =============================================================================

export const ZONE_ANCHOR_VARIANTS = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: SPRING_BLOOM },
}

export const FADE_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: SPRING_BLOOM },
}

export const ELASTIC_PING = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: { type: 'spring' as const, stiffness: 550, damping: 32, mass: 1 },
} as const

export const INTRO_FADE_UP_NO_DELAY = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
}

export const ZONE_HERO_FROM_SUMMARY = {
  initial: DAMPED_SLAM_INITIAL,
  animate: DAMPED_SLAM_ANIMATE,
  transition: SLAM_SPRING,
}
