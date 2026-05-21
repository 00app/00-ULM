/**
 * ULM application loop — hard ceilings from docs/ULM-APPLICATION-LOOP.md.
 * Import here instead of scattering magic numbers.
 */

/** Max journey + discovery cells on the main bento wall (excludes hero). */
export const MAX_ZONE_BENTO_CELLS = 24

/** Max custom discovery rows per user per journey_key (Neon + API throttle). */
export { MAX_DISCOVERY_INJECTIONS_PER_JOURNEY } from '@/lib/intelligence/manifest'

/** Rock rail: visible slots at cold start (rotation seeds 6). */
export const INITIAL_ROCK_SAVING_TIPS = 6

/** Rock rail absolute ceiling (includes earned / injected navy tips). */
export const MAX_ROCK_SAVING_TIPS_RAIL = 12

/** 12k kWh ≈ 1t CO₂e — baseline copy for profile / auditor prompts. */
export const ULM_KWH_PER_TONNE_CO2E = 12_000
