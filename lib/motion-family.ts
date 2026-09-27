/**
 * Framer presets for page, card and step motion — a thin layer over lib/motion.ts (the token
 * source). Every entrance is opacity + an 8px rise; every exit is opacity + a 4px drop, faster
 * and on ease-in. No blur, scale or letter-spacing tweens: they cost layout/filter work per
 * frame and read as decoration. The brand glitch logo is the only decorative animation.
 */

import type { Target, TargetAndTransition, Transition, Variant } from 'framer-motion'
import {
  DUR,
  EASE_OUT,
  EXIT_PX,
  REDUCED_CROSSFADE_SEC,
  RISE_PX,
  SPRING,
  STAGGER_SEC,
  T_ENTER,
  T_EXIT,
  T_LIFT,
} from '@/lib/motion'

export type FamilyMotionTargets = {
  initial: Target
  animate: Target
  exit: Target
}

export const FAMILY_EASE = EASE_OUT

/** Chapter changes, page enter, crystallise — all one enter duration now. */
export const FAMILY_DUR_LONG = DUR.enter
export const FAMILY_DUR_ATOMIC = DUR.enter
/** Interactions — like pulse, small reveals. */
export const FAMILY_DUR_SHORT = DUR.lift

export const FAMILY_RISE_PX = RISE_PX
/** @deprecated Use `FAMILY_RISE_PX`. */
export const FAMILY_GLIDE_PX = FAMILY_RISE_PX

/** Reading-speed buffer — sharp dwell per word before the next beat (content pacing, not motion). */
export const FAMILY_READ_MS_PER_WORD = 140

export const FAMILY_WORD_EXIT_MS = Math.round(DUR.exit * 1000)

export function familyTransition(duration: number = DUR.enter): Transition {
  return { duration, ease: EASE_OUT }
}

export const FAMILY_TRANSITION_LONG: Transition = T_ENTER
export const FAMILY_TRANSITION_SHORT: Transition = T_LIFT
export const FAMILY_TRANSITION_ATOMIC: Transition = T_ENTER

/** Stagger between zone bento cells; the page caps the sequence at six. */
export const ZONE_GRID_STAGGER_CHILD_DELAY_SEC = STAGGER_SEC

/** Card ↔ Solo Focus shell (`layoutId`) — the one spring. */
export const FAMILY_LAYOUT_SPRING = SPRING

export const FAMILY_ATOMIC_MS = Math.round(DUR.enter * 1000)

// -----------------------------------------------------------------------------
// Reading-speed contract
// -----------------------------------------------------------------------------

export function countReadableWords(text: string): number {
  const t = text.replace(/\n/g, ' ').trim()
  if (!t) return 1
  return t.split(/\s+/).filter(Boolean).length
}

/** Minimum ms a word stays sharp after it has entered. */
export function readingSpeedDwellMs(text: string, perWordMs = FAMILY_READ_MS_PER_WORD): number {
  return Math.max(perWordMs, countReadableWords(text) * perWordMs)
}

/** Full beat: enter + read buffer. */
export function atomicWordHoldMs(text: string): number {
  return FAMILY_ATOMIC_MS + readingSpeedDwellMs(text)
}

// -----------------------------------------------------------------------------
// Variants
// -----------------------------------------------------------------------------

const enterVariants: Record<string, Variant> = {
  hidden: { opacity: 0, y: RISE_PX },
  visible: { opacity: 1, y: 0, transition: T_ENTER },
  exit: { opacity: 0, y: EXIT_PX, transition: T_EXIT },
}

export const familyAtomicAssembly: Record<string, Variant> = enterVariants
export const familyAtomicSurface: Record<string, Variant> = enterVariants
export const familyReveal: Record<string, Variant> = enterVariants
export const familyGlide: Record<string, Variant> = enterVariants

export const FAMILY_ATOMIC_SURFACE_INITIAL = familyAtomicSurface.hidden as Target
export const FAMILY_ATOMIC_SURFACE_ANIMATE = familyAtomicSurface.visible as Target
export const FAMILY_ATOMIC_SURFACE_EXIT = familyAtomicSurface.exit as Target

export const familyPulse: Record<string, Variant> = {
  idle: { scale: 1 },
  pulse: { scale: [1, 1.05, 1], transition: T_LIFT } as Variant,
}

/** Zone bento cell — rise in, drop out; staggered by the parent. */
export const ZONE_ATOMIC_BENTO_VARIANTS: Record<string, Variant> = {
  hidden: { opacity: 0, y: RISE_PX },
  visible: { opacity: 1, y: 0, transition: T_ENTER },
  shrunk: { opacity: 0, y: EXIT_PX, transition: T_EXIT },
  ping: { opacity: [0, 1], y: [RISE_PX, 0], transition: T_ENTER } as Variant,
}

/** Card hover is CSS-only now (lift + shadow); kept as an empty target so call sites compile. */
export const FAMILY_ATOMIC_HOVER: TargetAndTransition = {}

// -----------------------------------------------------------------------------
// Props helpers
// -----------------------------------------------------------------------------

const REDUCED: FamilyMotionTargets = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const FULL: FamilyMotionTargets = {
  initial: familyAtomicSurface.hidden as Target,
  animate: familyAtomicSurface.visible as Target,
  exit: familyAtomicSurface.exit as Target,
}

export function familyPageEnterProps(
  reduceMotion: boolean
): FamilyMotionTargets & { transition: Transition } {
  return {
    ...(reduceMotion ? REDUCED : FULL),
    transition: reduceMotion ? { duration: REDUCED_CROSSFADE_SEC } : T_ENTER,
  }
}

/** @deprecated Prefer `familyPageEnterProps`. */
export const FAMILY_PAGE_ENTER = {
  ...FULL,
  transition: T_ENTER,
} as const

/** Cards, screens, Zai bubbles, Solo Focus. */
export function familyAtomicProps(reduceMotion: boolean): FamilyMotionTargets {
  return reduceMotion ? REDUCED : FULL
}

/** Intro / summary ticker. */
export function familyAtomicTextProps(reduceMotion: boolean): FamilyMotionTargets {
  return reduceMotion ? REDUCED : FULL
}

export function familyRevealProps(reduceMotion: boolean): FamilyMotionTargets {
  return reduceMotion ? REDUCED : FULL
}

/** Profile step shell. */
export function familyProfileStepProps(reduceMotion: boolean): FamilyMotionTargets {
  return reduceMotion ? REDUCED : FULL
}

export function zoneBentoLayoutId(cardId: string | undefined | null): string | undefined {
  const id = cardId?.trim()
  return id ? `zone-bento-${id}` : undefined
}

/** Delay for the nth control in a row: 40ms steps, first six only. */
export function familyControlDelaySec(optionIndex: number, base = 0): number {
  return base + Math.min(Math.max(optionIndex, 0), 5) * STAGGER_SEC
}

export const FAMILY_PULSE_TRANSITION = FAMILY_TRANSITION_SHORT
