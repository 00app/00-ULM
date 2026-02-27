'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface IntroWordCycleProps {
  words: string[]
  onComplete?: () => void
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 28 }

export default function IntroWordCycle({ words, onComplete }: IntroWordCycleProps) {
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
      }, 80)
    }, 120)
    return () => clearTimeout(timeout)
  }, [index, words.length, onComplete])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {visible && (
          <motion.h1
            key={index}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={spring}
            style={{
              color: 'var(--color-blue)',
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
          </motion.h1>
        )}
      </AnimatePresence>
    </div>
  )
}
