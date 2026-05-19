'use client'

import { useEffect, useState } from 'react'
import { ARCHITECTURAL_PULSE_DWELL_MS, ARCHITECTURAL_PULSE_WORDS } from '@/lib/architecturalPulse'

const WORDS = [...ARCHITECTURAL_PULSE_WORDS]

type Props = {
  active: boolean
}

/** One-word hydration ticker under Zone ASK ZAI — stays in viewport above the bento wall. */
export function ZoneGateWordPulse({ active }: Props) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!active) {
      setIdx(0)
      return
    }
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % WORDS.length)
    }, ARCHITECTURAL_PULSE_DWELL_MS)
    return () => window.clearInterval(id)
  }, [active])

  if (!active) return null

  return (
    <h3
      className="zone-gate-word-pulse zz-h3 question-text m-0 text-center w-full"
      style={{ color: 'var(--color-yellow)' }}
      aria-live="polite"
    >
      {WORDS[idx]}
    </h3>
  )
}
