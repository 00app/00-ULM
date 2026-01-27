'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type JourneyId } from '@/lib/journeys'
import JourneyGrid from '../components/JourneyGrid'
import CircleCTA from '../components/CircleCTA'

// Logo SVG paths
const logoPaths = [
  'M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z',
  'M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z',
  'M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411'
]

export default function ForkPage() {
  const router = useRouter()
  const [completedJourneys, setCompletedJourneys] = useState<JourneyId[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('completedJourneys')
    if (stored) {
      try {
        setCompletedJourneys(JSON.parse(stored))
      } catch {
        /* ignore */
      }
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        padding: '20px 0 100px 0',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--color-ice)',
      }}
    >
      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '0 20px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 51,
            height: 81,
            marginTop: 20,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <svg width="51" height="81" viewBox="0 0 126 200" fill="none">
            <path d={logoPaths[0]} fill="#000AFF" />
            <path d={logoPaths[1]} fill="#000AFF" />
            <path d={logoPaths[2]} fill="#000AFF" />
          </svg>
        </div>

        {/* Heading */}
        <h3 className="zone-message">
          continue or go to your zone.
        </h3>

        {/* Incomplete — SAME WRAPPER AS ZONE */}
        <div className="zone-incomplete-wrapper">
          <div className="incomplete-container">
            <h4 className="incomplete-label">
              {completedJourneys.length === 9 ? 'completed.' : 'explore more.'}
            </h4>

            <JourneyGrid
              completedJourneys={completedJourneys}
              onJourneyClick={(id) => router.push(`/journeys/${id}`)}
              showLabel={false}
            />
          </div>
        </div>
      </div>

      {/* Zone CTA */}
      <div
        style={{
          marginTop: 'auto',
          paddingBottom: 40,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <CircleCTA variant="text" text="ZONE" onClick={() => router.push('/zone')} />
      </div>
    </div>
  )
}
