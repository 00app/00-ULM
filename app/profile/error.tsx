'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/lib/routes'

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Profile route error:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-purple)',
        color: 'var(--color-yellow)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-roboto)',
          fontWeight: 800,
          lineHeight: 'var(--zz-lh-heading)',
        }}
      >
        Something went wrong
      </h2>
      <p style={{ margin: 0, fontSize: 20 }}>{error.message}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '12px 24px',
            borderRadius: 9999,
            border: 'none',
            background: 'var(--color-yellow)',
            color: 'var(--color-purple)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href={ROUTES.HOME}
          style={{
            padding: '12px 24px',
            borderRadius: 9999,
            border: '2px solid var(--color-yellow)',
            background: 'transparent',
            color: 'var(--color-yellow)',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Back to intro
        </Link>
      </div>
    </div>
  )
}
