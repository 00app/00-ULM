/**
 * Re-export — live unit rates live in `liveUnitRates.ts` (keeps `pg` out of client bundles).
 */
export {
  resolveLiveUnitRatesForPostcode,
  type LiveUnitRateSnapshot,
  type UnitRateSource,
} from '@/lib/brains/liveUnitRates'
