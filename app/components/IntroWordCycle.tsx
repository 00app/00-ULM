'use client'

import { useEffect, useState } from 'react'

interface IntroWordCycleProps {
  words: string[]
  onComplete?: () => void
}

/**
 * IntroWordCycle — Unified word cycler for all intro animations
 * 
 * Behavior:
 * - One word visible at a time
 * - Word fades in (120ms), disappears, next word
 * - Gap between words: 80ms
 * - Uses H1 only
 * - No stacked text
 * - State-driven only (no CSS keyframes)
 */
export default function IntroWordCycle({
  words,
  onComplete,
}: IntroWordCycleProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timeout: NodeJS.Timeout

    // show word
    setVisible(true)

    timeout = setTimeout(() => {
      // hide word
      setVisible(false)

      timeout = setTimeout(() => {
        if (index < words.length - 1) {
          setIndex(index + 1)
        } else {
          onComplete?.()
        }
      }, 80) // gap between words
    }, 120) // visible duration

    return () => clearTimeout(timeout)
  }, [index, words.length, onComplete])

  return (
    <h1
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 120ms linear',
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        color: 'var(--color-blue)',
        margin: 0,
      }}
    >
      {words[index]}.
    </h1>
  )
}
