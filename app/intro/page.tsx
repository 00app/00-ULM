'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CircleCTA from '../components/CircleCTA'
import IntroWordCycle from '../components/IntroWordCycle'
import '../intro.css'

// Logo SVG paths
const logoPaths = [
  'M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z',
  'M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z',
  'M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411'
]

type IntroScreen = 'glitch' | 'value-message' | 'use-less-more' | 'decision'

export default function IntroPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<IntroScreen>('glitch')

  // SCREEN 1: Logo Glitch - CSS animation handles 2 seconds, then auto-advance
  useEffect(() => {
    if (screen === 'glitch') {
      // Auto-advance after 2 seconds (glitch animation duration)
      const timer = setTimeout(() => {
        setScreen('value-message')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [screen])

  const handleCreateProfile = () => {
    router.push('/profile')
  }

  const handleSkip = () => {
    // Ensure Zone loads with starter content (default mode)
    // Zone page will handle this via buildZoneViewModel
    router.push('/zone')
  }

  // SCREEN 1: Logo Glitch (CSS animation)
  if (screen === 'glitch') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#FDFDFF',
        }}
      >
        <div className="zz-glitch">
          <img src="/assets/00 brand mark.svg" className="glitch-layer base" alt="Zero Zero" />
          <img src="/assets/00 brand mark pink.svg" className="glitch-layer pink" alt="" />
          <img src="/assets/00 brand mark lime.svg" className="glitch-layer cool" alt="" />
        </div>
      </div>
    )
  }

  // SCREEN 2: Value Message (auto-advance after completion)
  if (screen === 'value-message') {
    return (
      <div
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
          onComplete={() => {
            // Auto-advance to "use less. more." after value message completes
            setTimeout(() => {
              setScreen('use-less-more')
            }, 200) // Small delay after last word
          }}
        />
      </div>
    )
  }

  // SCREEN 3: "use less. more." (auto-advance)
  if (screen === 'use-less-more') {
    return (
      <div
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
          onComplete={() => {
            // Dwell 700ms, then advance
            setTimeout(() => {
              setScreen('decision')
            }, 700)
          }}
        />
      </div>
    )
  }

  // SCREEN 4: Decision
  return (
    <div
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
      <h1
        style={{
          textAlign: 'center',
          margin: 0,
          marginBottom: 20,
          color: 'var(--color-blue)',
        }}
      >
        create a profile
        <br />
        to start.
      </h1>

      <div
        style={{
          display: 'flex',
          gap: 40,
          alignItems: 'center',
        }}
      >
        {/* CREATE button - BLUE background, DEEP on hover */}
        <button
          onClick={handleCreateProfile}
          className="zz-button"
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-deep)'
            e.currentTarget.style.color = 'var(--color-ice)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-blue)'
            e.currentTarget.style.color = 'var(--color-ice)'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.background = 'var(--color-deep)'
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.background = 'var(--color-blue)'
          }}
        >
          create
        </button>

        {/* SKIP button - COOL background, same rollover as answer buttons */}
        <CircleCTA
          onClick={handleSkip}
          variant="text"
          text="skip"
        />
      </div>
    </div>
  )
}
