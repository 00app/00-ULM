'use client'

import { motion } from 'framer-motion'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
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
  onUnlike: () => void
  onActioned: () => void
}

/** Likes wall — offer handoff + unlike + mark actioned (Solo Focus trinity geometry). */
export function LikesCardActionTrinity({
  offerUrl,
  journeyKey,
  moneyGbp = 0,
  ctaLabel = 'VIEW',
  ctaSurface = 'pink',
  isActioned = false,
  onUnlike,
  onActioned,
}: LikesCardActionTrinityProps) {
  return (
    <motion.div
      className="solo-focus-trinity solo-focus-trinity--80 likes-card-trinity flex flex-row items-center justify-start flex-shrink-0 w-full"
      style={{ gap: 20, marginTop: 0, marginBottom: 0 }}
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
          surface={ctaSurface}
          className="solo-focus-trinity-cta"
        />
      ) : null}
      <motion.button
        type="button"
        className="circle-btn solo-focus-action-btn solo-focus-action-80 likes-card-trinity-unlike zz-shimmer-cta"
        onClick={onUnlike}
        transition={INDUSTRIAL_OPACITY_SNAP}
        aria-label="Remove from likes"
        style={{
          backgroundColor: 'var(--color-pink)',
          color: 'var(--color-yellow)',
        }}
      >
        <span className="circle-btn-label-stack" aria-hidden="true">
          <span>unlike</span>
        </span>
      </motion.button>
      <motion.button
        type="button"
        className="circle-btn solo-focus-action-btn solo-focus-action-80 likes-card-trinity-done zz-shimmer-cta"
        onClick={onActioned}
        transition={INDUSTRIAL_OPACITY_SNAP}
        aria-label={isActioned ? 'Unmark as actioned' : 'Mark as actioned'}
        style={{
          backgroundColor: isActioned ? 'var(--color-yellow)' : 'var(--color-purple)',
          color: isActioned ? 'var(--color-purple)' : 'var(--color-yellow)',
        }}
      >
        <span className="circle-btn-label-stack" aria-hidden="true">
          <span>done</span>
        </span>
      </motion.button>
    </motion.div>
  )
}
