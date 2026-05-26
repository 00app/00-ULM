'use client'

import { motion } from 'framer-motion'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'
import { HeartOutlineIcon, ZaiSparkIcon } from '@/app/components/ui/MonoStrokeIcons'

type Props = {
  ctaUrl?: string | null
  ctaLabel?: string
  journeyId?: string | null
  moneyGbp?: number
  ctaSurface?: 'pink' | 'yellow'
  isLiked?: boolean
  showLike?: boolean
  showAskZai?: boolean
  onLike?: () => void
  onAskZai?: () => void
}

export function SoloFocusActionTrinity({
  ctaUrl,
  ctaLabel = 'BUY',
  journeyId,
  moneyGbp = 0,
  ctaSurface = 'pink',
  isLiked = false,
  showLike = true,
  showAskZai = true,
  onLike,
  onAskZai,
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
            backgroundColor: isLiked ? 'var(--color-yellow)' : 'var(--color-pink)',
            color: isLiked ? 'var(--color-purple)' : 'var(--color-yellow)',
          }}
        >
          <HeartOutlineIcon size={22} />
        </motion.button>
      ) : null}
      {showAskZai && onAskZai ? (
        <motion.button
          type="button"
          className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-ask-zai-btn solo-focus-trinity-zai zz-shimmer-cta"
          onClick={onAskZai}
          transition={INDUSTRIAL_OPACITY_SNAP}
          aria-label="Ask Zai about this recommendation"
          style={{
            backgroundColor: 'var(--color-yellow)',
            color: 'var(--color-purple)',
          }}
        >
          <span className="solo-focus-ask-zai-visual" aria-hidden>
            <ZaiSparkIcon size={22} />
          </span>
        </motion.button>
      ) : null}
    </motion.div>
  )
}
