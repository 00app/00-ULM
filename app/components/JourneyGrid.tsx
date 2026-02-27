'use client'

import React, { useEffect } from 'react'
import { JOURNEY_ORDER, JOURNEYS, type JourneyId } from '@/lib/journeys'
import { useRouter } from 'next/navigation'

interface JourneyGridProps {
  completedJourneys?: JourneyId[]
  onJourneyClick?: (journeyId: JourneyId) => void
  showLabel?: boolean
}

/**
 * JourneyGrid - Shared component for Fork and Zone
 * - 3x3 grid on mobile (≤640px)
 * - 2 rows on tablet/desktop (≥641px): 6 journeys top row, 3 centered bottom row
 * - Cool background (#F8F8FE) for all buttons
 * - Blue text for incomplete, Pink text (#E80DAD) for completed
 */
export default function JourneyGrid({ 
  completedJourneys = [],
  onJourneyClick,
  showLabel = false
}: JourneyGridProps) {
  const router = useRouter()

  useEffect(() => {
    JOURNEY_ORDER.forEach((id) => router.prefetch(`/journeys/${id}`))
  }, [router])
  
  const getJourneyState = (journeyId: JourneyId): 'not_started' | 'in_progress' | 'completed' => {
    if (completedJourneys.includes(journeyId)) {
      return 'completed'
    }
    return 'not_started'
  }

  const handleJourneyClick = (e: React.MouseEvent, journeyId: JourneyId) => {
    e.preventDefault()
    if (onJourneyClick) {
      onJourneyClick(journeyId)
    } else {
      router.push(`/journeys/${journeyId}`)
    }
  }

  const allCompleted = completedJourneys.length === JOURNEY_ORDER.length
  
  // Get first word of journey name for button text
  const getButtonText = (journeyId: JourneyId): string => {
    const journey = JOURNEYS[journeyId]
    const journeyName = journey?.name || journeyId
    return journeyName.split(' ')[0].toUpperCase()
  }

  const getButtonStyle = (state: 'not_started' | 'in_progress' | 'completed'): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      width: 80,
      height: 80,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 40,
      background: '#F8F8FE', // COOL - ALWAYS
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'Roboto',
      fontSize: 10,
      fontWeight: 900,
      lineHeight: '14px',
      letterSpacing: 0,
      textTransform: 'uppercase',
      textAlign: 'center',
    }

    if (state === 'completed') {
      return {
        ...baseStyle,
        color: '#E80DAD', // PINK text only
        background: '#FDFDFF', // ICE background for completed
      }
    }

    return {
      ...baseStyle,
      color: '#000AFF', // BLUE text
    }
  }

  // Button interaction handled by .zz-button CSS class

  return (
    <div className="journey-grid-container">
      {showLabel && (
        <h4 className="journey-grid-label">
          {allCompleted ? 'completed.' : 'incomplete.'}
        </h4>
      )}
      <div className="journey-grid">
        {JOURNEY_ORDER.map((journeyId) => {
          const state = getJourneyState(journeyId)
          return (
            <button
              key={journeyId}
              type="button"
              className={`journey-button zz-button ${state === 'completed' ? 'completed' : ''}`}
              onClick={(e) => handleJourneyClick(e, journeyId)}
              style={getButtonStyle(state)}
              aria-label={`${journeyId} - ${state}`}
            >
              {getButtonText(journeyId)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
