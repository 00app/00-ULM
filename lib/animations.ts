/**
 * Zero Zero — motion contract: **two springs only** (+ reduced-motion linear shortcuts).
 *
 * - **KINETIC_SPRING** — taps, snaps, copy swaps, shimmer settle, word beats.
 * - **LAYOUT_SPRING** — Solo Focus zip, page shells, route presence, broad layout motion.
 *
 * Legacy names (`MECHANICAL_SNAP_SPRING`, `ZIP_OPEN_Z_TRANSITION`, `SPRING_TAP`, …) are aliases
 * so imports stay stable; do not introduce new stiffness/damping families.
 */

// =============================================================================
// THE TWO SPRINGS (only tuning surfaces)
// =============================================================================

export const KINETIC_SPRING = {
  type: 'spring' as const,
  stiffness: 720,
  damping: 22,
  mass: 0.78,
} as const

export const LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
} as const

/** @alias KINETIC_SPRING */
export const MECHANICAL_SNAP_SPRING = KINETIC_SPRING
/** @alias KINETIC_SPRING */
export const MECHANICAL_SNAP_REPLACEMENT_SPRING = KINETIC_SPRING
/** @alias KINETIC_SPRING */
export const SLAM_SPRING = KINETIC_SPRING
/** @alias KINETIC_SPRING */
export const SPRING_TAP = KINETIC_SPRING
/** @alias LAYOUT_SPRING */
export const INSTANT_BLOOM = LAYOUT_SPRING
/** @alias LAYOUT_SPRING */
export const SPRING_BLOOM = LAYOUT_SPRING
/** @alias KINETIC_SPRING — intro/profile decision circles */
export const INTRO_DECISION_CTA_SPRING = KINETIC_SPRING

// =============================================================================
// DAMPED SLAM — scale + opacity (springs above drive timing)
// =============================================================================

export const DAMPED_SLAM_INITIAL = { scale: 1.08, opacity: 0 }
export const DAMPED_SLAM_ANIMATE = { scale: 1, opacity: 1 }
export const DAMPED_SLAM_EXIT = { scale: 0.96, opacity: 0 }

export const SLAM_INTRO_INITIAL = DAMPED_SLAM_INITIAL
export const SLAM_INTRO_ANIMATE = DAMPED_SLAM_ANIMATE
export const SLAM_INTRO_EXIT = DAMPED_SLAM_EXIT

// =============================================================================
// Z-Axis zip-open / zip-shut (3D lift; LAYOUT_SPRING on enter/exit spring paths)
// =============================================================================

export const ZIP_OPEN_Z_TRANSITION = LAYOUT_SPRING

export const ZIP_OPEN_Z_INITIAL = {
  scale: 0.9,
  opacity: 0,
  z: -100,
  rotateX: 5,
} as const

export const ZIP_OPEN_Z_ANIMATE = {
  scale: 1,
  opacity: 1,
  z: 0,
  rotateX: 0,
} as const

/** Exit-only tween (not a third spring family — quick zip shut). */
export const ZIP_SHUT_Z_EXIT = {
  scale: 0.9,
  opacity: 0,
  z: -100,
  rotateX: -5,
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
} as const

/** Props for `motion.div` (AnimatePresence) — Z-axis zip; respects reduced motion. */
export function soloFocusSlamMotionProps(reduceMotion: boolean, skipInitialSlam: boolean) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1, scale: 1, z: 0, rotateX: 0 },
      exit: { opacity: 0, transition: { duration: 0.12 } },
      transition: { duration: 0.12 },
    }
  }
  return {
    initial: skipInitialSlam ? (false as const) : ZIP_OPEN_Z_INITIAL,
    animate: ZIP_OPEN_Z_ANIMATE,
    exit: ZIP_SHUT_Z_EXIT,
    transition: ZIP_OPEN_Z_TRANSITION,
  }
}

/** Full-screen Solo Focus portal shell (`.expanded-solo-focus`) — same Z-tokens. */
export function soloFocusShellZipMotionProps(reduceMotion: boolean) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1, scale: 1, z: 0, rotateX: 0 },
      exit: { opacity: 0, transition: { duration: 0.12 } },
      transition: { duration: 0.12 },
    }
  }
  return {
    initial: ZIP_OPEN_Z_INITIAL,
    animate: ZIP_OPEN_Z_ANIMATE,
    exit: ZIP_SHUT_Z_EXIT,
    transition: ZIP_OPEN_Z_TRANSITION,
  }
}

/** Page-level kinetic zip — Likes, Settings, full-route shells (same tokens as Solo Focus). */
export const KINETIC_ZIP_PULSE = {
  initial: ZIP_OPEN_Z_INITIAL,
  animate: ZIP_OPEN_Z_ANIMATE,
  exit: ZIP_SHUT_Z_EXIT,
  transition: ZIP_OPEN_Z_TRANSITION,
} as const

// =============================================================================
// DURATIONS
// =============================================================================

export const KINETIC_WORD_DWELL_MS = 400

// =============================================================================
// PRESETS (both springs resolve to KINETIC_SPRING or LAYOUT_SPRING)
// =============================================================================

/** Zone main shell — snap assembly (no opacity fade). */
export const FADE_IN_UP = {
  initial: { opacity: 1, scale: 0.97, y: 20, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 1, scale: 0.98, y: 14, filter: 'blur(3px)', transition: KINETIC_SPRING },
  transition: KINETIC_SPRING,
}

export const WORD_APPEAR = {
  initial: DAMPED_SLAM_INITIAL,
  animate: DAMPED_SLAM_ANIMATE,
  exit: DAMPED_SLAM_EXIT,
  transition: KINETIC_SPRING,
}

export const WORD_PULSE_APPEAR = {
  initial: { opacity: 1, scale: 0.85, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: KINETIC_SPRING,
  },
  exit: {
    opacity: 1,
    scale: 0.92,
    filter: 'blur(5px)',
    transition: KINETIC_SPRING,
  },
} as const

// =============================================================================
// ZONE
// =============================================================================

export const ZONE_ANCHOR_VARIANTS = {
  hidden: { opacity: 1, scale: 0.92, y: 22, filter: 'blur(4px)' },
  visible: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: KINETIC_SPRING },
}

/** Solo Focus / bento copy blocks — snap, not opacity mush. */
export const FADE_VARIANTS = {
  hidden: { opacity: 1, scale: 0.94, y: 6, filter: 'blur(5px)' },
  visible: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: KINETIC_SPRING },
}

export const ELASTIC_PING = {
  initial: { scale: 0.9, opacity: 1, filter: 'blur(5px)' },
  animate: { scale: 1, opacity: 1, filter: 'blur(0px)' },
  exit: { scale: 0.92, opacity: 1, filter: 'blur(4px)' },
  transition: KINETIC_SPRING,
} as const

// =============================================================================
// Shimmer / intro — kinetic snap only (pairs with `.zz-shimmer-focus` in globals.css)
// =============================================================================

export const SHIMMER_FOCUS = {
  initial: {
    filter: 'blur(20px)',
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    filter: 'blur(0px)',
    opacity: 1,
    scale: 1,
  },
  /** Lens snap: fixed-duration ease (not a third spring tuning). */
  transition: {
    duration: 0.34,
    ease: [0.22, 1, 0.36, 1] as const,
  },
} as const

export const SHIMMER_FOCUS_INITIAL = SHIMMER_FOCUS.initial
export const SHIMMER_FOCUS_ANIMATE = SHIMMER_FOCUS.animate
/** Legacy export — shimmer uses `SHIMMER_FOCUS.transition` (ease), not a spring. */
export const SHIMMER_FOCUS_SPRING = SHIMMER_FOCUS.transition

/** Profile / intro decision circles — same spring as all kinetic taps. */
export const INTRO_DECISION_CTA_TRANSITION = KINETIC_SPRING

/** Step / word exit — sharp → blur */
export const SHIMMER_FOCUS_EXIT = {
  filter: 'blur(14px)',
  opacity: 0,
  scale: 0.97,
} as const

export const SHIMMER_FOCUS_EXIT_TRANSITION = KINETIC_SPRING

/** Dwell while sharp after lens snap (intro kinetic line only) */
export const INTRO_SHIMMER_WORD_DWELL_MS = 520

/** Gap after word exit before next word enters (stagger cadence) */
export const INTRO_SHIMMER_WORD_GAP_MS = 120

/** Solo Focus zip-shut: max answers per overlay open (lane-lock drill-down, sync with Sentinel runner). */
export const SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION = 3

export const INTRO_FADE_UP_NO_DELAY = {
  initial: { opacity: 1, scale: 0.94, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 1, scale: 0.96, y: 8, filter: 'blur(3px)' },
  transition: KINETIC_SPRING,
}

export const ZONE_HERO_FROM_SUMMARY = {
  initial: DAMPED_SLAM_INITIAL,
  animate: DAMPED_SLAM_ANIMATE,
  transition: KINETIC_SPRING,
}
