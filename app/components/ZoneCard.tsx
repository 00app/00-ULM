'use client'

/**
 * Zone grid journey tile — Tier 2 mother/child swap, offer handoff, and Solo Focus.
 * Implementation lives in {@link JourneyBentoCard}; this module is the Zone-facing export.
 */
export {
  JourneyBentoCard as ZoneCard,
  type JourneyBentoCardProps as ZoneCardProps,
} from '@/app/components/JourneyBentoCard'

export {
  fetchTier2ScrapeSync,
  openOfferUrlInNewTab,
  buildTier2MorphCard,
  readBrowserResearchUserId,
  runTier2MotherChildSwap,
  TIER2_PROFILE_REFRESH_EVENT,
} from '@/lib/zone/tier2RecursiveSpawner'
export {
  resolveClientResearchUserId,
  appendResearchUserIdQuery,
} from '@/lib/zone/garyMode'
