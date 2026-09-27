/**
 * Motion tokens — the single source of truth for every animation in the product.
 * Mirrors the CSS custom properties in app/globals.css (`--dur-*`, `--ease-*`); change both
 * together. Durations are seconds (Framer's unit); the CSS side is milliseconds.
 *
 * One easing does everything (ease-out). Ease-in is for exits only, spring is for release and
 * expand only. Linear is reserved for progress bars and looping pulses.
 */

export const DUR = {
  press: 0.07,
  colour: 0.14,
  lift: 0.22,
  enter: 0.36,
  exit: 0.22,
  burst: 0.56,
} as const

export type Bezier = [number, number, number, number]
export const EASE_OUT: Bezier = [0.22, 1, 0.36, 1]
export const EASE_IN: Bezier = [0.64, 0, 0.78, 0]
export const EASE_SPRING: Bezier = [0.34, 1.56, 0.64, 1]

/** Framer spring for release, card → Solo Focus expand and sheet open. */
export const SPRING = { type: 'spring', stiffness: 420, damping: 32 } as const

/** Enter distance / exit distance (px). Exits are shorter and faster than entries. */
export const RISE_PX = 8
export const EXIT_PX = 4

/** Stagger between siblings; only the first six animate in sequence. */
export const STAGGER_SEC = 0.04
export const STAGGER_MAX = 6
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER_MAX - 1) * STAGGER_SEC
}

export const T_ENTER = { duration: DUR.enter, ease: EASE_OUT }
export const T_EXIT = { duration: DUR.exit, ease: EASE_IN }
export const T_LIFT = { duration: DUR.lift, ease: EASE_OUT }
export const T_COLOUR = { duration: DUR.colour, ease: EASE_OUT }
export const T_PRESS = { duration: DUR.press, ease: EASE_OUT }

/** Reduced motion: no transforms, colour/opacity crossfade only. */
export const REDUCED_CROSSFADE_SEC = 0.12

export const T_REDUCED = { duration: REDUCED_CROSSFADE_SEC }

/** Looping status pulse (loading dots, "connecting" text) — one of the two linear uses. */
export function pulseLoop(delaySec = 0) {
  return {
    duration: 0.9,
    repeat: Infinity,
    repeatType: 'reverse' as const,
    ease: 'linear' as const,
    delay: delaySec,
  }
}

/** Number roll-up on figures (ms). */
export const COUNT_UP_MS = 520
