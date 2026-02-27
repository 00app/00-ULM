'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import CircleCTA from './CircleCTA'
import IntroWordCycle from './IntroWordCycle'
import '../intro.css'

const springBounce = { type: 'spring' as const, stiffness: 380, damping: 26 }
const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: springBounce,
}

type IntroScreenState = 'glitch' | 'value-message' | 'use-less-more' | 'decision'

export default function IntroScreen() {
  const router = useRouter()
  const [screen, setScreen] = useState<IntroScreenState>('glitch')

  useEffect(() => {
    if (screen === 'glitch') {
      const timer = setTimeout(() => setScreen('value-message'), 2000)
      return () => clearTimeout(timer)
    }
  }, [screen])

  const handleCreateProfile = () => router.push('/profile')
  const handleSkip = () => router.push('/zone')

  return (
    <AnimatePresence mode="wait">
      {screen === 'glitch' && (
        <motion.div
          key="glitch"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={springBounce}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#FDFDFF',
          }}
        >
          <motion.div
            className="zz-glitch"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springBounce, delay: 0.1 }}
          >
            <img src="/assets/00%20brand%20mark.svg" className="glitch-layer base" alt="Zero Zero" />
            <img src="/assets/00%20brand%20mark%20pink.svg" className="glitch-layer pink" alt="" aria-hidden />
            <img src="/assets/00%20brand%20mark%20lime.svg" className="glitch-layer cool" alt="" aria-hidden />
          </motion.div>
        </motion.div>
      )}

      {screen === 'value-message' && (
        <motion.div
          key="value-message"
          {...fadeInUp}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#FDFDFF',
          }}
        >
          <IntroWordCycle
            words={['save', 'money', 'cut', 'carbon', 'feel', 'good']}
            onComplete={() => setTimeout(() => setScreen('use-less-more'), 200)}
          />
        </motion.div>
      )}

      {screen === 'use-less-more' && (
        <motion.div
          key="use-less-more"
          {...fadeInUp}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#FDFDFF',
          }}
        >
          <IntroWordCycle
            words={['use', 'less', 'more']}
            onComplete={() => setTimeout(() => setScreen('decision'), 700)}
          />
        </motion.div>
      )}

      {screen === 'decision' && (
        <motion.div
          key="decision"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#FDFDFF',
            gap: 20,
          }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springBounce, delay: 0.08 }}
            style={{
              textAlign: 'center',
              margin: 0,
              marginBottom: 20,
              color: 'var(--color-blue)',
              fontFamily: 'Roboto',
              fontSize: 'clamp(50px, 12vw, 100px)',
              fontWeight: 900,
              letterSpacing: '-2px',
              lineHeight: 1,
              textTransform: 'lowercase',
            }}
          >
            create a profile
            <br />
            to start.
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springBounce, delay: 0.2 }}
            style={{ display: 'flex', gap: 40, alignItems: 'center' }}
          >
            <motion.button
              onClick={handleCreateProfile}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              transition={springBounce}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                border: 'none',
                background: 'var(--color-blue)',
                color: 'var(--color-ice)',
                fontFamily: 'Roboto',
                fontSize: 10,
                lineHeight: '14px',
                fontWeight: 900,
                letterSpacing: '0',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              create
            </motion.button>
            <CircleCTA onClick={handleSkip} variant="text" text="skip" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
