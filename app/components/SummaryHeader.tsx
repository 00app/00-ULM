'use client'

/**
 * Profile summary (`/profile/summary`) — **Mechanical Snap** ticker:
 * one word on screen at a time via `IntroWordCycle` + **`opacityTicker`**
 * Atomic Assembly (blur cloud → sharp) + reading-speed dwell per word.
 *
 * Hero £ / kg for Zone handoff: `sumSavingsFromUserGenome` (Neon `user_genome` JSONB).
 */
import IntroWordCycle from '@/app/components/IntroWordCycle'
import { sumSavingsFromUserGenome } from '@/lib/brains/genomeTotals'

export { sumSavingsFromUserGenome }
import { INTRO_ROUTE_WORD_EXIT_MS, SUMMARY_KINETIC_WORD_GAP_MS } from '@/lib/animations'
import { atomicWordHoldMs } from '@/lib/motion-family'

export type SummaryHeaderProps = {
  words: string[]
  pulseGenomeMoney?: boolean
  onComplete?: () => void
}

export default function SummaryHeader({ words, pulseGenomeMoney = false, onComplete }: SummaryHeaderProps) {
  const wordDurations = words.length > 0 ? words.map((w) => atomicWordHoldMs(w)) : undefined

  return (
    <IntroWordCycle
      words={words}
      onComplete={onComplete}
      preserveCase
      preservePunctuation
      trailingPeriod={false}
      gapMs={SUMMARY_KINETIC_WORD_GAP_MS}
      wordDurations={wordDurations}
      wrapLongPreservedWords
      fitToViewportPaddingPx={40}
      wordExitMs={INTRO_ROUTE_WORD_EXIT_MS}
      opacityTicker
      pulseGenomeMoney={pulseGenomeMoney}
    />
  )
}
