'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/lib/routes'

const CHUNK_RELOAD_KEY = 'zz-chunk-reload-once'

function isChunkLoadError(message: string): boolean {
  return /Loading chunk|ChunkLoadError|dynamically imported module|Importing a module script failed/i.test(
    message,
  )
}

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const chunkStale = isChunkLoadError(error?.message ?? '')

  useEffect(() => {
    console.error('Profile route error:', error)
  }, [error])

  useEffect(() => {
    if (!chunkStale || typeof window === 'undefined') return
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    window.location.reload()
  }, [chunkStale])

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
        textAlign: 'center',
        fontFamily: 'var(--font-roboto), Roboto, sans-serif',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-marvin), sans-serif',
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 'var(--zz-lh-heading)',
        }}
      >
        Something went wrong
      </h2>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 20 }}>
        {chunkStale ? 'A new version was deployed. Refresh to load the latest app.' : error.message}
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => {
            if (chunkStale && typeof window !== 'undefined') {
              sessionStorage.removeItem(CHUNK_RELOAD_KEY)
              window.location.reload()
              return
            }
            reset()
          }}
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
