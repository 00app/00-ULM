'use client'

import { motion } from 'framer-motion'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

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
  ctaLabel = 'BUY / DO',
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={INDUSTRIAL_OPACITY_SNAP}
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
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill={isLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
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
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 0 1 11.5 3.5h1A8.5 8.5 0 0 1 21 12z" />
              <circle cx="9.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="12.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
            </svg>
          </span>
        </motion.button>
      ) : null}
    </motion.div>
  )
}
