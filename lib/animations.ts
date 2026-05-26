/**
 * Zero Zero motion — Zone/Solo industrial tokens + legacy exports.
 * **Family Liquid (Profile, Summary, Likes, Settings):** `lib/motion-family.ts` + `docs/MOTION-FAMILY.md`.
 */

// =============================================================================
// INDUSTRIAL SNAP (single timing surface)
// =============================================================================

export const INDUSTRIAL_OPACITY_SNAP = {
  type: 'tween' as const,
  duration: 0.12,
  ease: 'linear' as const,
} as const

// =============================================================================
// VERTICAL STACCATO — industrial: opacity-only stagger (legacy y export = 0)
// =============================================================================

/** Seconds between sibling reveals (word / row / grid cell). */
export const STACCATO_STAGGER_SEC = 0.05
/** Legacy vertical drop — fussy motion y: 2 -> 0 */
export const STACCATO_DROP_PX = 2
/** Per-element motion length. */
export const STACCATO_DURATION_SEC = 0.12
/** Fussy ease token. */
export const STACCATO_EASE = 'linear' as const
/** Cubic fallback. */
export const STACCATO_EASE_CUBIC = 'linear' as const

export const STACCATO_TWEEN = INDUSTRIAL_OPACITY_SNAP

export const STACCATO_CONTAINER_VARIANTS = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STACCATO_STAGGER_SEC,
      delayChildren: 0,
    },
  },
} as const

export const STACCATO_CHILD_VARIANTS = {
  hidden: { opacity: 0, y: 2 },
  visible: {
    opacity: 1,
    y: 0,
    transition: STACCATO_TWEEN,
  },
} as const

// =============================================================================
// DAMPED SLAM — scale + opacity (linear snap timing)
// =============================================================================

export const DAMPED_SLAM_INITIAL = { opacity: 0, y: 2 }
export const DAMPED_SLAM_ANIMATE = { opacity: 1, y: 0 }
export const DAMPED_SLAM_EXIT = { opacity: 0, y: 2 }

export const SLAM_INTRO_INITIAL = DAMPED_SLAM_INITIAL
export const SLAM_INTRO_ANIMATE = DAMPED_SLAM_ANIMATE
export const SLAM_INTRO_EXIT = DAMPED_SLAM_EXIT

// =============================================================================
// Z-Axis zip-open / zip-shut
// =============================================================================

export const ZIP_OPEN_Z_TRANSITION = INDUSTRIAL_OPACITY_SNAP

export const ZIP_OPEN_Z_INITIAL = {
  opacity: 0,
  y: 2,
} as const

export const ZIP_OPEN_Z_ANIMATE = {
  opacity: 1,
  y: 0,
} as const

/** Exit — opacity snap only. */
export const ZIP_SHUT_Z_EXIT = {
  opacity: 0,
  y: 2,
  transition: { duration: 0.12, ease: 'linear' as const },
} as const

/** Expanded Solo Focus shell — quick mechanical zip (staccato DNA). */
export const EXPANDED_CARD_CLOSE_TRANSITION = {
  duration: STACCATO_DURATION_SEC,
  ease: STACCATO_EASE_CUBIC,
}

/** Expanded shell open — same cadence. */
export const EXPANDED_CARD_OPEN_TRANSITION = {
  duration: STACCATO_DURATION_SEC,
  ease: STACCATO_EASE_CUBIC,
}

/** Coordinates used when collapsing the expanded portal (matches prior bespoke exit pose). */
export const EXPANDED_CARD_EXIT_COORDS = {
  opacity: 0,
  y: 2,
} as const

/** Props for `motion.div` — opacity snap; respects reduced motion. */
export function soloFocusSlamMotionProps(reduceMotion: boolean, skipInitialSlam: boolean) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: INDUSTRIAL_OPACITY_SNAP },
      transition: INDUSTRIAL_OPACITY_SNAP,
    }
  }
  return {
    initial: skipInitialSlam ? (false as const) : ZIP_OPEN_Z_INITIAL,
    animate: ZIP_OPEN_Z_ANIMATE,
    exit: ZIP_SHUT_Z_EXIT,
    transition: ZIP_OPEN_Z_TRANSITION,
  }
}

/** Full-screen Solo Focus portal shell (`.expanded-solo-focus`) — same tokens. */
export function soloFocusShellZipMotionProps(reduceMotion: boolean) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: INDUSTRIAL_OPACITY_SNAP },
      transition: INDUSTRIAL_OPACITY_SNAP,
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
// PRESETS
// =============================================================================

/** Zone main shell — opacity snap only. */
export const FADE_IN_UP = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0 },
  transition: STACCATO_TWEEN,
  exit: { opacity: 0, y: 2, transition: INDUSTRIAL_OPACITY_SNAP },
}

export const WORD_APPEAR = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 2 },
  transition: INDUSTRIAL_OPACITY_SNAP,
}

export const WORD_PULSE_APPEAR = {
  initial: { opacity: 0, y: 2 },
  animate: {
    opacity: 1,
    y: 0,
    transition: INDUSTRIAL_OPACITY_SNAP,
  },
  exit: {
    opacity: 0,
    y: 2,
    transition: INDUSTRIAL_OPACITY_SNAP,
  },
} as const

// =============================================================================
// ZONE
// =============================================================================

export const ZONE_ANCHOR_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: STACCATO_TWEEN },
}

/** Zone bento ripple + atomic crystallize — see `lib/motion-family.ts`. */
export {
  ZONE_ATOMIC_BENTO_VARIANTS as ZONE_BENTO_CELL_VARIANTS,
  ZONE_GRID_STAGGER_CHILD_DELAY_SEC,
} from '@/lib/motion-family'

/** Solo Focus: zip-shut rail collapse — matches CSS `.solo-focus-loop` + inject gate in `EmbeddedJourneyQuestion`. */
export const SOLO_FOCUS_ZIP_SHUT_SEC = 0.12

/** Delay before content snap after shell motion (layout settle). */
export const SOLO_FOCUS_CONTENT_SNAP_DELAY_SEC = 0.05

/** Solo Focus content handoff — opacity snap only. */
export const SOLO_FOCUS_CONTENT_SNAP_INITIAL = {
  opacity: 0,
  y: 2,
} as const
export const SOLO_FOCUS_CONTENT_SNAP_ANIMATE = {
  opacity: 1,
  y: 0,
} as const

/** Solo Focus / bento copy blocks — opacity snap. */
export const FADE_VARIANTS = {
  hidden: { opacity: 0, y: 2 },
  visible: { opacity: 1, y: 0, transition: STACCATO_TWEEN },
}

export const ELASTIC_PING = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 2 },
  transition: INDUSTRIAL_OPACITY_SNAP,
}

// =============================================================================
// Shimmer / intro — kinetic snap only (pairs with `.zz-shimmer-focus` in globals.css)
// =============================================================================

export const SHIMMER_FOCUS = {
  initial: {
    opacity: 0,
    y: 2,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  transition: INDUSTRIAL_OPACITY_SNAP,
} as const

export const SHIMMER_FOCUS_INITIAL = SHIMMER_FOCUS.initial
export const SHIMMER_FOCUS_ANIMATE = SHIMMER_FOCUS.animate
/** Legacy export — shimmer uses `SHIMMER_FOCUS.transition`. */
/** Step / word exit — opacity snap */
export const SHIMMER_FOCUS_EXIT = {
  opacity: 0,
} as const

/** Intro / summary / segment loading — additional ~30% faster (stacks with `FAMILY_MOTION_SCALE`). */
export const INTRO_TYPE_MOTION_SCALE = 0.7

/** `/` + `/intro` kinetic word line — tuned with `INTRO_TYPE_MOTION_SCALE`. */
export const INTRO_SHIMMER_WORD_DWELL_MS = Math.round(728 * INTRO_TYPE_MOTION_SCALE)
export const INTRO_SHIMMER_WORD_GAP_MS = Math.round(84 * INTRO_TYPE_MOTION_SCALE)

/** Profile summary kinetic line — speed-locked to IntroWordCycle. */
export const SUMMARY_KINETIC_WORD_DWELL_MS = INTRO_SHIMMER_WORD_DWELL_MS
export const SUMMARY_KINETIC_WORD_GAP_MS = INTRO_SHIMMER_WORD_GAP_MS

/** Intro + summary: exit beat between opacity-ticker words. */
export const INTRO_ROUTE_WORD_EXIT_MS = Math.round(105 * INTRO_TYPE_MOTION_SCALE)

/** Intro safety timer tail after max word path. */
export const INTRO_ROUTE_SAFETY_TAIL_MS = Math.round(560 * INTRO_TYPE_MOTION_SCALE)

/** `AtomicLogo` loop interval on route loading surfaces. */
export const LOADING_ATOMIC_LOOP_MS = Math.round(
  (Math.round(1.0 * 0.7 * 1000) + 120) * INTRO_TYPE_MOTION_SCALE
)

/** Solo Focus zip-shut: max answers per overlay open (lane-lock drill-down, sync with Sentinel runner). */
export const SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION = 3

export const INTRO_FADE_UP_NO_DELAY = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: INDUSTRIAL_OPACITY_SNAP },
  transition: INDUSTRIAL_OPACITY_SNAP,
}

export const ZONE_HERO_FROM_SUMMARY = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: INDUSTRIAL_OPACITY_SNAP,
}

/** Zone bento punch-through after Architectural Pulse `DONE.` */
export const ZONE_GRID_PUNCH_THROUGH = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.85 },
}
