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

// =============================================================================
// v28 — Z-Axis Zip-Open / Zip-Shut (3D lift; pair with perspective on shell)
// =============================================================================

export const ZIP_OPEN_Z_TRANSITION = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
}

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

/** Exit-only token — duration tween (not spring). */
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

// =============================================================================
// v6 — KINETIC SHIMMER (Fussy blur → lens focus) — Intro words + decision headline
// Pairs with `.zz-shimmer-focus` in globals.css (will-change: filter, transform)
// =============================================================================

/** Single preset: blur 20px → sharp, spring 400/30/1 */
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
  transition: {
    duration: 0.34,
    ease: [0.22, 1, 0.36, 1] as const,
  },
} as const

export const SHIMMER_FOCUS_INITIAL = SHIMMER_FOCUS.initial
export const SHIMMER_FOCUS_ANIMATE = SHIMMER_FOCUS.animate
export const SHIMMER_FOCUS_SPRING = SHIMMER_FOCUS.transition

/** Intro decision CTAs — bloom tension v6 (520 / 28 / 0.55); delays applied in IntroScreen */
export const INTRO_DECISION_CTA_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 28,
  mass: 0.55,
}

/**
 * ELASTIC_PING spring family + v6 intro CTA tension (scale 0 → 1 on mount with delay in UI).
 */
export const INTRO_DECISION_CTA_TRANSITION = {
  ...ELASTIC_PING.transition,
  stiffness: 520,
  damping: 28,
  mass: 0.55,
} as const

/** Step / word exit — sharp → blur (profile step change, intro word cycle) */
export const SHIMMER_FOCUS_EXIT = {
  filter: 'blur(14px)',
  opacity: 0,
  scale: 0.97,
} as const

export const SHIMMER_FOCUS_EXIT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 32,
  mass: 0.85,
} as const

/** Dwell while sharp after lens snap (intro kinetic line only) */
export const INTRO_SHIMMER_WORD_DWELL_MS = 520

/** Gap after word exit before next word enters (stagger cadence) */
export const INTRO_SHIMMER_WORD_GAP_MS = 120

/** Solo Focus zip-shut: max answers per overlay open (lane-lock drill-down, sync with Sentinel runner). */
export const SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION = 3

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
