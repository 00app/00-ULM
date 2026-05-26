/**
 * 00 Family Liquid + Atomic Assembly — delivery physics (not brains).
 * Liquid: chapter glide/reveal. Atomic: particles crystallizing into sharp 2px strokes.
 */

import type { Target, TargetAndTransition, Transition, Variant } from 'framer-motion'

export type FamilyMotionTargets = {
  initial: Target
  animate: Target
  exit: Target
}

export const FAMILY_EASE = [0.22, 1, 0.36, 1] as const

/** Global motion scale (1 = handbook default; 0.7 ≈ 30% faster). */
export const FAMILY_MOTION_SCALE = 0.7

/** Chapter changes — Profile step, page enter. */
export const FAMILY_DUR_LONG = 0.8 * FAMILY_MOTION_SCALE

/** Crystallize / atomic assembly (intro, summary, zone cells, loop question). */
export const FAMILY_DUR_ATOMIC = 1.0 * FAMILY_MOTION_SCALE

/** Interactions — like pulse, hover bloom. */
export const FAMILY_DUR_SHORT = 0.4 * FAMILY_MOTION_SCALE

export const FAMILY_GLIDE_PX = 15

export const FAMILY_BLUR_PX = 12

/** Summary ticker — lighter cloud before lock (Director: 2–4px feel; atomic cloud uses 15px). */
export const FAMILY_BLUR_SUMMARY_PX = 3

export const FAMILY_ATOMIC_BLUR_IN_PX = 15
export const FAMILY_ATOMIC_BLUR_OUT_PX = 10
export const FAMILY_ATOMIC_LETTER_IN = '0.4em'
export const FAMILY_ATOMIC_LETTER_OUT = '-0.02em'
export const FAMILY_ATOMIC_LETTER_LOCKED = 'normal'

/** Reading-speed buffer — sharp dwell before next beat assembles. */
export const FAMILY_READ_MS_PER_WORD = Math.round(200 * FAMILY_MOTION_SCALE)

export const FAMILY_WORD_EXIT_MS = Math.round(FAMILY_DUR_SHORT * 1000 * 0.65)

export function familyTransition(duration = FAMILY_DUR_LONG): Transition {
  return { duration, ease: [...FAMILY_EASE] }
}

export const FAMILY_TRANSITION_LONG = familyTransition(FAMILY_DUR_LONG)
export const FAMILY_TRANSITION_SHORT = familyTransition(FAMILY_DUR_SHORT)
export const FAMILY_TRANSITION_ATOMIC = familyTransition(FAMILY_DUR_ATOMIC)

/** Stagger between zone bento cells during atomic ripple. */
export const ZONE_GRID_STAGGER_CHILD_DELAY_SEC = 0.12 * FAMILY_MOTION_SCALE

/** Liquid morph — bento cell ↔ Solo Focus shell (`layoutId`). */
export const FAMILY_LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 34,
  mass: 0.85,
}

export const FAMILY_ATOMIC_MS = Math.round(FAMILY_DUR_ATOMIC * 1000)

// -----------------------------------------------------------------------------
// Reading-speed contract
// -----------------------------------------------------------------------------

export function countReadableWords(text: string): number {
  const t = text.replace(/\n/g, ' ').trim()
  if (!t) return 1
  return t.split(/\s+/).filter(Boolean).length
}

/** Minimum ms word stays sharp after assembly completes (~200ms per word). */
export function readingSpeedDwellMs(text: string, perWordMs = FAMILY_READ_MS_PER_WORD): number {
  return Math.max(perWordMs, countReadableWords(text) * perWordMs)
}

/** Full beat: crystallize (1s) + read buffer. */
export function atomicWordHoldMs(text: string): number {
  return Math.round(FAMILY_DUR_ATOMIC * 1000) + readingSpeedDwellMs(text)
}

// -----------------------------------------------------------------------------
// Variants
// -----------------------------------------------------------------------------

export const familyAtomicAssembly: Record<string, Variant> = {
  hidden: {
    opacity: 0,
    scale: 1.05,
    filter: `blur(${FAMILY_ATOMIC_BLUR_IN_PX}px)`,
    letterSpacing: FAMILY_ATOMIC_LETTER_IN,
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    letterSpacing: FAMILY_ATOMIC_LETTER_LOCKED,
    transition: FAMILY_TRANSITION_ATOMIC,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    filter: `blur(${FAMILY_ATOMIC_BLUR_OUT_PX}px)`,
    letterSpacing: FAMILY_ATOMIC_LETTER_OUT,
    transition: familyTransition(FAMILY_DUR_SHORT * 0.75),
  },
}

export const familyReveal: Record<string, Variant> = {
  hidden: { opacity: 0, filter: `blur(${FAMILY_BLUR_PX}px)` },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: FAMILY_TRANSITION_LONG,
  },
  exit: {
    opacity: 0,
    filter: `blur(${Math.round(FAMILY_BLUR_PX * 0.65)}px)`,
    transition: familyTransition(FAMILY_DUR_SHORT * 0.75),
  },
}

export const familyGlide: Record<string, Variant> = {
  hidden: { opacity: 0, x: FAMILY_GLIDE_PX },
  visible: { opacity: 1, x: 0, transition: FAMILY_TRANSITION_LONG },
  exit: { opacity: 0, x: -FAMILY_GLIDE_PX * 0.5, transition: familyTransition(FAMILY_DUR_SHORT * 0.75) },
}

export const familyPulse: Record<string, Variant> = {
  idle: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    transition: FAMILY_TRANSITION_SHORT,
  },
}

/** Zone bento — crystallize from blur cloud into locked card (not y-slide snap). */
export const ZONE_ATOMIC_BENTO_VARIANTS: Record<string, Variant> = {
  hidden: {
    opacity: 0,
    scale: 1.04,
    filter: `blur(${FAMILY_ATOMIC_BLUR_IN_PX}px)`,
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: FAMILY_TRANSITION_ATOMIC,
  },
  shrunk: {
    opacity: 0,
    scale: 0.96,
    filter: `blur(${FAMILY_ATOMIC_BLUR_OUT_PX}px)`,
    transition: familyTransition(FAMILY_DUR_SHORT * 0.6),
  },
  ping: {
    opacity: [0, 1],
    scale: [1.02, 1],
    filter: ['blur(8px)', 'blur(0px)'],
    transition: FAMILY_TRANSITION_ATOMIC,
  },
}

/** Subtle atom jitter on hover (paired with `.zz-atomic-hover` CSS). */
export const FAMILY_ATOMIC_HOVER: TargetAndTransition = {
  x: [0, 0.5, -0.5, 0.25, 0],
  y: [0, -0.5, 0.5, -0.25, 0],
  transition: { duration: 0.45, ease: [...FAMILY_EASE] },
}

export function familyPageEnterProps(reduceMotion: boolean): FamilyMotionTargets & { transition: Transition } {
  const atomic = familyAtomicProps(reduceMotion)
  return {
    ...atomic,
    transition: reduceMotion ? FAMILY_TRANSITION_SHORT : FAMILY_TRANSITION_ATOMIC,
  }
}

/** @deprecated Prefer `familyPageEnterProps` — kept for spread in likes/settings. */
export const FAMILY_PAGE_ENTER = {
  initial: { opacity: 0, scale: 1.05, filter: `blur(${FAMILY_ATOMIC_BLUR_IN_PX}px)` },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.95, filter: `blur(${FAMILY_ATOMIC_BLUR_OUT_PX}px)` },
  transition: FAMILY_TRANSITION_ATOMIC,
} as const

// -----------------------------------------------------------------------------
// Props helpers
// -----------------------------------------------------------------------------

export function familyAtomicProps(reduceMotion: boolean): FamilyMotionTargets {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }
  return {
    initial: familyAtomicAssembly.hidden as Target,
    animate: familyAtomicAssembly.visible as Target,
    exit: familyAtomicAssembly.exit as Target,
  }
}

export function familyRevealProps(
  reduceMotion: boolean,
  blurPx: number = FAMILY_BLUR_PX
): FamilyMotionTargets {
  const blur = Math.max(0, Math.min(24, blurPx))
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }
  return {
    initial: { opacity: 0, filter: `blur(${blur}px)` },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: `blur(${Math.max(2, Math.round(blur * 0.65))}px)` },
  }
}

/**
 * Profile step shell — blur cross-fade only (no letter-spacing on children).
 * Headlines use `familyAtomicProps` separately so postcode `zz-input` keeps Marvin.
 */
export function familyProfileStepProps(reduceMotion: boolean): FamilyMotionTargets {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }
  return {
    initial: { opacity: 0, scale: 1.03, filter: `blur(${FAMILY_ATOMIC_BLUR_IN_PX}px)` },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: {
      opacity: 0,
      scale: 0.98,
      filter: `blur(${FAMILY_ATOMIC_BLUR_OUT_PX}px)`,
    },
  }
}

export function zoneBentoLayoutId(cardId: string | undefined | null): string | undefined {
  const id = cardId?.trim()
  return id ? `zone-bento-${id}` : undefined
}

export function familyControlDelaySec(optionIndex: number, base = 0.12): number {
  return base + optionIndex * (FAMILY_DUR_SHORT * 0.25)
}

export const FAMILY_PULSE_TRANSITION = FAMILY_TRANSITION_SHORT
