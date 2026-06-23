'use client'

import { motion } from 'framer-motion'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

type Props = {
  ctaUrl?: string | null
  ctaLabel?: string
  journeyId?: string | null
  moneyGbp?: number
  ctaSurface?: 'pink' | 'yellow'
  isLiked?: boolean
  isDisliked?: boolean
  showLike?: boolean
  showAskZai?: boolean
  showDislike?: boolean
  onLike?: () => void
  onAskZai?: () => void
  onDislike?: () => void
  onCtaClick?: () => void
}

export function SoloFocusActionTrinity({
  ctaUrl,
  ctaLabel = 'BUY',
  journeyId,
  moneyGbp = 0,
  ctaSurface = 'pink',
  isLiked = false,
  isDisliked = false,
  showLike = true,
  showAskZai = true,
  showDislike = true,
  onLike,
  onAskZai,
  onDislike,
  onCtaClick,
}: Props) {
  return (
    <motion.div
      className="solo-focus-trinity solo-focus-trinity--80 impact-to-trinity flex flex-row items-center justify-start flex-shrink-0 w-full"
      style={{ gap: 20, marginTop: 0, marginBottom: 0 }}
      initial={FAMILY_ATOMIC_SURFACE_INITIAL}
      animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
      transition={FAMILY_TRANSITION_ATOMIC}
    >
      {ctaUrl ? (
        <IndustrialHandoffButton
          url={ctaUrl}
          journeyId={journeyId}
          moneyValue={moneyGbp}
          ctaLabel={ctaLabel}
          surface={ctaSurface === 'yellow' ? 'yellow' : 'pink'}
          className="solo-focus-trinity-cta"
          onHandoffClick={onCtaClick}
        />
      ) : null}
      {showLike && onLike ? (
        <motion.button
          type="button"
          className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-trinity-like zz-shimmer-cta"
          onClick={onLike}
          transition={INDUSTRIAL_OPACITY_SNAP}
          aria-label="Like"
          style={{
            backgroundColor: isLiked ? 'var(--brand-select-bg)' : 'var(--color-pink)',
            color: isLiked ? 'var(--brand-select-fg)' : 'var(--color-yellow)',
          }}
        >
          <span className="circle-btn-label-stack" aria-hidden="true">
            <span>like</span>
          </span>
        </motion.button>
      ) : null}
      {showAskZai && onAskZai ? (
        <motion.button
          type="button"
          className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-ask-zai-btn solo-focus-trinity-zai zz-shimmer-cta"
          onClick={onAskZai}
          transition={INDUSTRIAL_OPACITY_SNAP}
          aria-label="Ask about this offer"
        >
          <span className="circle-btn-label-stack" aria-hidden="true">
            <span>ask</span>
          </span>
        </motion.button>
      ) : null}
      {showDislike && onDislike ? (
        <motion.button
          type="button"
          className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-trinity-dislike zz-shimmer-cta"
          onClick={onDislike}
          transition={INDUSTRIAL_OPACITY_SNAP}
          aria-label="Not interested"
          style={{
            backgroundColor: isDisliked ? 'var(--brand-select-bg)' : 'var(--color-pink)',
            color: isDisliked ? 'var(--brand-select-fg)' : 'var(--color-yellow)',
          }}
        >
          <span className="circle-btn-label-stack" aria-hidden="true">
            <span>nope</span>
          </span>
        </motion.button>
      ) : null}
    </motion.div>
  )
}
