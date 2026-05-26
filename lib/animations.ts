/**
 * Zero Zero motion — Zone/Solo industrial tokens + legacy exports.
 * **Family Liquid (Profile, Summary, Likes, Settings, Zone):** `lib/motion-family.ts` + `docs/MOTION-FAMILY.md`.
 * Cards / screens / zone cells share `familyAtomicSurface` (rise + blur + `FAMILY_TRANSITION_ATOMIC`).
 */
import {
  familyAtomicProps,
  familyAtomicSurface,
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_EXIT,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

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
  hidden: familyAtomicSurface.hidden,
  visible: {
    ...familyAtomicSurface.visible,
    transition: FAMILY_TRANSITION_ATOMIC,
  },
} as const

// =============================================================================
// DAMPED SLAM — scale + opacity (linear snap timing)
// =============================================================================

export const DAMPED_SLAM_INITIAL = FAMILY_ATOMIC_SURFACE_INITIAL
export const DAMPED_SLAM_ANIMATE = FAMILY_ATOMIC_SURFACE_ANIMATE
export const DAMPED_SLAM_EXIT = FAMILY_ATOMIC_SURFACE_EXIT

export const SLAM_INTRO_INITIAL = DAMPED_SLAM_INITIAL
export const SLAM_INTRO_ANIMATE = DAMPED_SLAM_ANIMATE
export const SLAM_INTRO_EXIT = DAMPED_SLAM_EXIT

// =============================================================================
// Z-Axis zip-open / zip-shut
// =============================================================================

export const ZIP_OPEN_Z_TRANSITION = INDUSTRIAL_OPACITY_SNAP

export const ZIP_OPEN_Z_INITIAL = FAMILY_ATOMIC_SURFACE_INITIAL

export const ZIP_OPEN_Z_ANIMATE = FAMILY_ATOMIC_SURFACE_ANIMATE

/** Exit — atomic surface rise + blur (same as intro crystallize). */
export const ZIP_SHUT_Z_EXIT = {
  ...FAMILY_ATOMIC_SURFACE_EXIT,
  transition: FAMILY_TRANSITION_ATOMIC,
} as const

/** Expanded Solo Focus shell — atomic crystallize open/close. */
export const EXPANDED_CARD_CLOSE_TRANSITION = FAMILY_TRANSITION_ATOMIC

export const EXPANDED_CARD_OPEN_TRANSITION = FAMILY_TRANSITION_ATOMIC

export const EXPANDED_CARD_EXIT_COORDS = FAMILY_ATOMIC_SURFACE_EXIT

/** Props for `motion.div` — atomic surface; respects reduced motion. */
export function soloFocusSlamMotionProps(reduceMotion: boolean, skipInitialSlam: boolean) {
  const atomic = familyAtomicProps(reduceMotion)
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: atomic.animate,
      exit: { ...atomic.exit, transition: INDUSTRIAL_OPACITY_SNAP },
      transition: INDUSTRIAL_OPACITY_SNAP,
    }
  }
  return {
    initial: skipInitialSlam ? (false as const) : atomic.initial,
    animate: atomic.animate,
    exit: atomic.exit,
    transition: FAMILY_TRANSITION_ATOMIC,
  }
}

/** Full-screen Solo Focus portal shell (`.expanded-solo-focus`) — same tokens. */
export function soloFocusShellZipMotionProps(reduceMotion: boolean) {
  return soloFocusSlamMotionProps(reduceMotion, false)
}

/** Page-level kinetic enter — Likes, Settings, route shells. */
export const KINETIC_ZIP_PULSE = {
  initial: FAMILY_ATOMIC_SURFACE_INITIAL,
  animate: FAMILY_ATOMIC_SURFACE_ANIMATE,
  exit: ZIP_SHUT_Z_EXIT,
  transition: FAMILY_TRANSITION_ATOMIC,
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
  initial: FAMILY_ATOMIC_SURFACE_INITIAL,
  animate: FAMILY_ATOMIC_SURFACE_ANIMATE,
  transition: FAMILY_TRANSITION_ATOMIC,
  exit: { ...FAMILY_ATOMIC_SURFACE_EXIT, transition: FAMILY_TRANSITION_ATOMIC },
}

export const WORD_APPEAR = {
  initial: FAMILY_ATOMIC_SURFACE_INITIAL,
  animate: FAMILY_ATOMIC_SURFACE_ANIMATE,
  exit: FAMILY_ATOMIC_SURFACE_EXIT,
  transition: FAMILY_TRANSITION_ATOMIC,
}

export const WORD_PULSE_APPEAR = {
  initial: FAMILY_ATOMIC_SURFACE_INITIAL,
  animate: {
    ...FAMILY_ATOMIC_SURFACE_ANIMATE,
    transition: FAMILY_TRANSITION_ATOMIC,
  },
  exit: {
    ...FAMILY_ATOMIC_SURFACE_EXIT,
    transition: FAMILY_TRANSITION_ATOMIC,
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
export const SOLO_FOCUS_CONTENT_SNAP_INITIAL = FAMILY_ATOMIC_SURFACE_INITIAL
export const SOLO_FOCUS_CONTENT_SNAP_ANIMATE = FAMILY_ATOMIC_SURFACE_ANIMATE

/** Solo Focus / bento copy blocks — opacity snap. */
export const FADE_VARIANTS = {
  hidden: familyAtomicSurface.hidden,
  visible: { ...familyAtomicSurface.visible, transition: FAMILY_TRANSITION_ATOMIC },
}

export const ELASTIC_PING = {
  initial: FAMILY_ATOMIC_SURFACE_INITIAL,
  animate: FAMILY_ATOMIC_SURFACE_ANIMATE,
  exit: FAMILY_ATOMIC_SURFACE_EXIT,
  transition: FAMILY_TRANSITION_ATOMIC,
}

// =============================================================================
// Shimmer / intro — kinetic snap only (pairs with `.zz-shimmer-focus` in globals.css)
// =============================================================================

export const SHIMMER_FOCUS = {
  initial: FAMILY_ATOMIC_SURFACE_INITIAL,
  animate: FAMILY_ATOMIC_SURFACE_ANIMATE,
  transition: FAMILY_TRANSITION_ATOMIC,
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

/** Zone bento punch-through — container fade; cells crystallize via `ZONE_BENTO_CELL_VARIANTS` stagger. */
export const ZONE_GRID_PUNCH_THROUGH = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: FAMILY_TRANSITION_ATOMIC,
}
