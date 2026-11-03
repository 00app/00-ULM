/**
 * Household data service (PRD v4, Z3). Import from here.
 *
 * Pure parts (records, registry, builder, queries, synthetic) are safe anywhere; `service.ts` reads
 * Neon and the filesystem, so import it from server code only.
 */

export * from '@/lib/household/records'
export * from '@/lib/household/factRegistry'
export * from '@/lib/household/buildHousehold'
export * from '@/lib/household/queries'
export {
  SYNTHETIC_STORIES,
  generateSyntheticHouseholds,
  isSyntheticHouseholdsEnabled,
  type SyntheticHousehold,
  type SyntheticStory,
} from '@/lib/household/synthetic'
