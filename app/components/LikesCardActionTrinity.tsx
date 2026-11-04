'use client'

import { motion } from 'framer-motion'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

type LikesCardActionTrinityProps = {
  offerUrl?: string | null
  journeyKey?: string | null
  moneyGbp?: number
  ctaLabel?: string
  ctaSurface?: 'pink' | 'yellow'
  isActioned?: boolean
  /** True while likes are still loading from the server; Remove is a toggle and must wait for the real list. */
  removeDisabled?: boolean
  onUnlike: () => void
  onActioned: () => void
}

/**
 * Likes wall — offer handoff + unlike + mark actioned, as a brand pill row (docs/BRAND-LANGUAGE.md),
 * same treatment as the Solo Focus action row. Carries its own .zz-brand scope.
 */
export function LikesCardActionTrinity({
  offerUrl,
  journeyKey,
  moneyGbp = 0,
  ctaLabel = 'VIEW',
  isActioned = false,
  removeDisabled = false,
  onUnlike,
  onActioned,
}: LikesCardActionTrinityProps) {
  return (
    <motion.div
      className="zz-brand solo-focus-trinity likes-card-trinity likes-card-trinity--brand flex flex-row flex-wrap items-center justify-start flex-shrink-0 w-full"
      initial={FAMILY_ATOMIC_SURFACE_INITIAL}
      animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
      transition={FAMILY_TRANSITION_ATOMIC}
    >
      {offerUrl ? (
        <IndustrialHandoffButton
          url={offerUrl}
          journeyId={journeyKey}
          moneyValue={moneyGbp}
          ctaLabel={ctaLabel}
          className="solo-focus-trinity-cta"
          variant="pill"
        />
      ) : null}
      <div className="likes-card-trinity__secondary">
      <button
        type="button"
        className="zzb-btn zzb-btn--sm zzb-btn--outline likes-card-trinity-unlike"
        onClick={onUnlike}
        disabled={removeDisabled}
        aria-label="Remove from likes"
      >
        Remove
      </button>
      <button
        type="button"
        className="zzb-btn zzb-btn--sm zzb-btn--outline likes-card-trinity-done"
        onClick={onActioned}
        aria-label={isActioned ? 'Unmark as actioned' : 'Mark as actioned'}
        aria-pressed={isActioned}
      >
        {isActioned ? 'Done' : 'Mark done'}
      </button>
      </div>
    </motion.div>
  )
}
