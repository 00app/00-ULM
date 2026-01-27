'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../../context/AppContext'
import CircleCTA from '../../components/CircleCTA'

export default function ProfileSummaryPage() {
  const router = useRouter()
  const { state } = useApp()
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [showCTA, setShowCTA] = useState(false)

  // Summary text - one line at a time
  const summaryLines = [
    'you could save',
    '£1145',
    'and',
    '1000k co₂e.',
  ]

  // Animation: Match intro speed - 0.4s per line (hard cuts, no fade delays)
  useEffect(() => {
    if (currentLineIndex < summaryLines.length) {
      const timer = setTimeout(() => {
        if (currentLineIndex < summaryLines.length - 1) {
          setCurrentLineIndex(prev => prev + 1)
        } else {
          // Final line complete - auto-advance to Fork
          setTimeout(() => {
            router.push('/fork')
          }, 400) // Small delay after final word
        }
      }, 400) // 0.4s per line (matches intro speed)

      return () => clearTimeout(timer)
    }
  }, [currentLineIndex, summaryLines.length, router])

  const handleContinue = () => {
    router.push('/fork')
  }

  useEffect(() => {
    if (!state.userId) {
      router.push('/profile')
    }
  }, [state.userId, router])

  if (!state.userId) {
    return null
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#FDFDFF',
      position: 'relative'
    }}>
      {/* Summary text container - 385×172 */}
      <div style={{
        display: 'flex',
        width: 385,
        height: 172,
        flexDirection: 'column',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {summaryLines.map((line, index) => (
          <div
            key={index}
            style={{
              fontFamily: 'Roboto',
              fontWeight: 900,
              letterSpacing: '-2px',
              textTransform: 'lowercase',
              color: '#000AFF',
              textAlign: 'center',
              opacity: index === currentLineIndex ? 1 : 0,
              transition: 'none',
              position: index === currentLineIndex ? 'relative' : 'absolute',
              visibility: index === currentLineIndex ? 'visible' : 'hidden'
            }}
            className="intro-font-size"
          >
            {line}
          </div>
        ))}
      </div>
      
      {/* CTA appears after animation */}
      {showCTA && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          <CircleCTA onClick={handleContinue} variant="arrow" />
        </div>
      )}
    </div>
  )
}
