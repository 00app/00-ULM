/**
 * Gravity Grid tokens: the brand background field (docs/BRAND-LANGUAGE.md, "Gravity Grid").
 * Pale dots behind the UI that bend toward the finger or cursor, leave a faint blue trace and
 * settle back. Colours mirror --field-* in app/styles/brand.css; change both together.
 *
 * Units: CSS px for distances, ms for time. Bounce is off (the brand bans bounce), so dots
 * settle critically damped; zetaBounce is kept so it can be tried on the dev page.
 */
export const FIELD = {
  colours: {
    ground: '#FCFCFF',
    rest: '#D9DCF2',
    blue: '#000AFF',
  },
  grid: {
    /** Dot spacing in CSS px. Never smaller. */
    pitch: 12,
    dotRadius: 1,
  },
  pull: {
    amp: 14,
    sigma: 48,
    reach: 150,
    maxShareOfDistance: 0.85,
  },
  tap: {
    amp: 7,
    sigma: 26,
    maxMs: 200,
    maxMove: 6,
  },
  hover: {
    amp: 6,
    sigma: 90,
    tint: 0,
    idleMs: 1000,
  },
  tint: {
    sigma: 36,
    /** Max tint over text marked data-field-quiet. 0.12 keeps every dot pixel at 4.5:1 or better
     * against muted body text (#4b4a6b); 0.35 dropped to 2.7:1 under a single dot. */
    capQuiet: 0.12,
    traceRest: 0.18,
    gamma: 0.9,
    buckets: 16,
  },
  /** Durations in ms. */
  time: {
    touchIn: 120,
    release: 700,
    traceFade: 2000,
    clearFade: 350,
    scrollSettle: 350,
    tapLife: 700,
  },
  trace: {
    floor: 0.3,
    windowMs: 1200,
    sampleSpacing: 4,
    maxSamples: 400,
  },
  scroll: {
    maxLag: 5,
    leadFalloff: 260,
    gain: 6,
  },
  spring: {
    /** Off: the brand language rules out bounce. */
    bounce: false,
    zetaBounce: 0.62,
    zetaNoBounce: 1.0,
    maxOvershoot: 2,
  },
  /** The one brand ease (lib/motion.ts EASE_OUT). */
  ease: [0.22, 1, 0.36, 1],
  dprCap: 2,
} as const

export type FieldTokens = typeof FIELD
