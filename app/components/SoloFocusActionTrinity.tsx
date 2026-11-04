'use client'

import { motion } from 'framer-motion'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import { HeartOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
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
  /** Brand-language pill row (docs/BRAND-LANGUAGE.md) instead of the 80px circles. */
  brand?: boolean
}

/** Order: like · Ask Zai (secondary circle) · the CTA (claim / switch / buy) · dislike. */
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
  brand = false,
}: Props) {
  if (brand) {
    // When the card's own link is the Zai fallback, the blue pill already says "Ask Zai".
    const ctaIsZai = Boolean(ctaUrl) && /^ask\s*zai$/i.test(ctaLabel.trim())
    return (
      <div className="solo-focus-trinity solo-focus-trinity--brand flex flex-row flex-wrap items-center justify-start w-full">
        {showLike && onLike ? (
          <button
            type="button"
            className="zzb-btn zzb-btn--outline solo-focus-trinity-like"
            onClick={onLike}
            aria-pressed={isLiked}
          >
            <HeartOutlineIcon size={16} style={{ fill: isLiked ? 'currentColor' : 'none' }} />
            {isLiked ? 'Saved' : 'Save'}
          </button>
        ) : null}
        {showAskZai && onAskZai && !ctaIsZai ? (
          <button type="button" className="zzb-btn zzb-btn--outline solo-focus-trinity-zai" onClick={onAskZai}>
            Ask Zai
          </button>
        ) : null}
        {ctaUrl ? (
          <IndustrialHandoffButton
            url={ctaUrl}
            journeyId={journeyId}
            moneyValue={moneyGbp}
            ctaLabel={ctaLabel}
            className="solo-focus-trinity-cta"
            onHandoffClick={onCtaClick}
            variant="pill"
          />
        ) : null}
        {showDislike && onDislike ? (
          <button
            type="button"
            className="zzb-btn zzb-btn--outline solo-focus-trinity-dislike"
            onClick={onDislike}
            aria-pressed={isDisliked}
          >
            Not for me
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <motion.div
      className="solo-focus-trinity solo-focus-trinity--80 impact-to-trinity flex flex-row items-center justify-start flex-shrink-0 w-full"
      style={{ gap: 20, marginTop: 0, marginBottom: 0 }}
      initial={FAMILY_ATOMIC_SURFACE_INITIAL}
      animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
      transition={FAMILY_TRANSITION_ATOMIC}
    >
      {showLike && onLike ? (
        <motion.button
          type="button"
          className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-trinity-like zz-shimmer-cta"
          onClick={onLike}
          transition={INDUSTRIAL_OPACITY_SNAP}
          aria-label="Like"
          style={{
            backgroundColor: isLiked ? 'var(--brand-select-bg)' : 'var(--color-blue)',
            color: isLiked ? 'var(--brand-select-fg)' : 'var(--color-blue)',
          }}
        >
          <HeartOutlineIcon size={28} style={{ fill: isLiked ? 'currentColor' : 'none' }} />
        </motion.button>
      ) : null}
      {showAskZai && onAskZai ? (
        <motion.button
          type="button"
          className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-ask-zai-btn solo-focus-trinity-zai zz-shimmer-cta"
          onClick={onAskZai}
          transition={INDUSTRIAL_OPACITY_SNAP}
          aria-label="Ask Zai"
        >
          <span className="circle-btn-label-stack" aria-hidden="true">
            <span>ask</span>
            <span>zai</span>
          </span>
        </motion.button>
      ) : null}
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
      {showDislike && onDislike ? (
        <motion.button
          type="button"
          className="circle-btn solo-focus-action-btn solo-focus-action-80 solo-focus-trinity-dislike zz-shimmer-cta"
          onClick={onDislike}
          transition={INDUSTRIAL_OPACITY_SNAP}
          aria-label="Dislike"
          style={{
            backgroundColor: isDisliked ? 'var(--brand-select-bg)' : 'var(--color-blue)',
            color: isDisliked ? 'var(--brand-select-fg)' : 'var(--color-blue)',
          }}
        >
          <span className="circle-btn-label-stack" aria-hidden="true">
            <span>dislike</span>
          </span>
        </motion.button>
      ) : null}
    </motion.div>
  )
}
