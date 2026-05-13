'use client'

/**
 * Profile summary (`/profile/summary`) — **Mechanical Snap** ticker:
 * one word on screen at a time via `IntroWordCycle` + **`opacityTicker`**
 * (opacity 0→1 only — no Style A glitch, no blur pulse).
 */
import IntroWordCycle from '@/app/components/IntroWordCycle'
import { SUMMARY_KINETIC_WORD_DWELL_MS, SUMMARY_KINETIC_WORD_GAP_MS } from '@/lib/animations'

export type SummaryHeaderProps = {
  words: string[]
  onComplete?: () => void
}

export default function SummaryHeader({ words, onComplete }: SummaryHeaderProps) {
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
      wordExitMs={Math.round(SUMMARY_KINETIC_WORD_GAP_MS * 0.85)}
      opacityTicker
    />
  )
}
