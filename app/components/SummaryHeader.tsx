'use client'

/**
 * Profile summary (`/profile/summary`) — **Mechanical Snap** ticker:
 * one word on screen at a time via `IntroWordCycle` + **`opacityTicker`**
 * (opacity 0→1 only — no Style A glitch, no blur pulse).
 *
 * Hero £ / kg for Zone handoff: `sumSavingsFromUserGenome` (Neon `user_genome` JSONB).
 */
import IntroWordCycle from '@/app/components/IntroWordCycle'
import { sumSavingsFromUserGenome } from '@/lib/brains/genomeTotals'

export { sumSavingsFromUserGenome }
import {
  INTRO_ROUTE_WORD_EXIT_MS,
  SUMMARY_KINETIC_WORD_DWELL_MS,
  SUMMARY_KINETIC_WORD_GAP_MS,
} from '@/lib/animations'

export type SummaryHeaderProps = {
  words: string[]
  pulseGenomeMoney?: boolean
  onComplete?: () => void
}

export default function SummaryHeader({ words, pulseGenomeMoney = false, onComplete }: SummaryHeaderProps) {
  const dwell = SUMMARY_KINETIC_WORD_DWELL_MS
  const wordDurations = words.length > 0 ? words.map(() => dwell) : undefined

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
