'use client'

import Link from 'next/link'
import { JOURNEY_IDS, JOURNEY_LABELS, JOURNEY_COLORS } from '@/lib/journeys'

export default function JourneysListPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-ice)',
        padding: 24,
        paddingTop: 48,
      }}
    >
      <Link
        href="/zone"
        style={{
          fontFamily: 'Roboto',
          fontSize: 14,
          color: 'var(--color-blue)',
          marginBottom: 24,
          display: 'inline-block',
        }}
      >
        ← Zone
      </Link>
      <h1
        style={{
          fontFamily: 'Roboto',
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: '-1px',
          color: 'var(--color-deep)',
          marginBottom: 24,
        }}
      >
        Journeys
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {JOURNEY_IDS.map((id) => (
          <Link
            key={id}
            href={`/journeys/${id}`}
            style={{
              background: JOURNEY_COLORS[id],
              color: 'var(--color-deep)',
              borderRadius: 16,
              padding: 20,
              textDecoration: 'none',
              fontFamily: 'Roboto',
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            {JOURNEY_LABELS[id]}
          </Link>
        ))}
      </div>
    </div>
  )
}
