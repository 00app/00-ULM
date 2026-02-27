/**
 * RAPID WORD CYCLE — Animated text that flashes words one at a time
 *
 * Use after the logo or on its own. One word visible at a time:
 * - 120ms visible, 80ms gap, then next word
 * - Calls onComplete when the last word is done
 *
 * Usage:
 *   import IntroWordCycle from './IntroWordCycle'
 *   <IntroWordCycle words={['save','money','cut','carbon']} onComplete={() => {}} />
 */

'use client'

import { useEffect, useState } from 'react'

export interface IntroWordCycleProps {
  /** Words to show in order; each appears for 120ms with 80ms gap. */
  words: string[]
  /** Called after the last word is shown. */
  onComplete?: () => void
  /** Text color. Default #000AFF */
  textColor?: string
  /** Optional className for the wrapper. */
  className?: string
}

export default function IntroWordCycle({
  words,
  onComplete,
  textColor = '#000AFF',
  className,
}: IntroWordCycleProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    setVisible(true)
    timeout = setTimeout(() => {
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
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 120ms linear',
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        color: textColor,
        margin: 0,
        fontFamily: 'Roboto, sans-serif',
        fontSize: 'clamp(60px, 15vw, 100px)',
        lineHeight: 1,
        letterSpacing: '-2px',
        fontWeight: 900,
        textTransform: 'lowercase',
      }}
    >
      {words[index]}.
    </h1>
  )
}
