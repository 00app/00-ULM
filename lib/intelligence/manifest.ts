/**
 * Zero Zero Intelligence Loop — manifest constants (no secrets).
 * Neon host must match `DATABASE_URL` pooler; set password only in env / Vercel.
 */
export const MANIFEST_NEON_POOLER_HOST = 'ep-floral-recipe-abgv0qmu-pooler.eu-west-2.aws.neon.tech'

/** Max custom discovery injections per user per journey_key (API + Neon throttle). */
export const MAX_DISCOVERY_INJECTIONS_PER_JOURNEY = 3
