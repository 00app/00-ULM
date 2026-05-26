'use client'

import { motion } from 'framer-motion'
import IntroWordCycle from '@/app/components/IntroWordCycle'
import { ARCHITECTURAL_PULSE_WORDS } from '@/lib/architecturalPulse'
import { INTRO_ROUTE_WORD_EXIT_MS } from '@/lib/animations'
import { atomicWordHoldMs } from '@/lib/motion-family'

type Props = {
  onComplete: () => void
  /** Fade the final DONE. beat as the grid punches through. */
  fadingOut?: boolean
  /** When embedded in Discovery Takeover (not full-screen fixed overlay). */
  overlayZIndex?: number
  /** Inline pulse (no fixed fullscreen layer). */
  inline?: boolean
}

const WORDS = [...ARCHITECTURAL_PULSE_WORDS]
const DWELLS = WORDS.map((w) => atomicWordHoldMs(w))

export function ArchitecturalPulse({
  onComplete,
  fadingOut = false,
  overlayZIndex = 200,
  inline = false,
}: Props) {
  return (
    <motion.div
      className="architectural-pulse-overlay zz-profile-page mode-ui"
      role="status"
      aria-live="polite"
      aria-label="Preparing your savings wall"
      initial={{ opacity: 1 }}
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: fadingOut ? 0.35 : 0.12, ease: 'linear' }}
      style={
        inline
          ? {
              position: 'relative',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              pointerEvents: fadingOut ? 'none' : 'auto',
            }
          : {
              position: 'fixed',
              inset: 0,
              zIndex: overlayZIndex,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              pointerEvents: fadingOut ? 'none' : 'auto',
            }
      }
    >
      <IntroWordCycle
        words={WORDS}
        preserveCase
        trailingPeriod={false}
        gapMs={0}
        wordDurations={DWELLS}
        wordExitMs={INTRO_ROUTE_WORD_EXIT_MS}
        opacityTicker
        fitToViewportPaddingPx={inline ? 40 : 0}
        onComplete={onComplete}
        holdFinalWord
      />
    </motion.div>
  )
}
