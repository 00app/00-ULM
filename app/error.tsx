'use client'

import { useEffect } from 'react'

const CHUNK_RELOAD_KEY = 'zz-chunk-reload-once'

function isChunkLoadError(message: string): boolean {
  return /Loading chunk|ChunkLoadError|dynamically imported module|Importing a module script failed/i.test(
    message,
  )
}

/**
 * App Router error boundary — avoids a blank screen when a client subtree throws.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const chunkStale = isChunkLoadError(error?.message ?? '')

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
      <h1
        style={{
          fontFamily: 'var(--font-marvin), sans-serif',
          fontSize: 28,
          margin: 0,
          lineHeight: 'var(--zz-lh-heading)',
        }}
      >
        Something went wrong
      </h1>
      <p style={{ margin: 0, maxWidth: 420 }}>
        {chunkStale
          ? 'A new version was deployed. Refresh to load the latest app.'
          : error?.message || 'Unknown error'}
      </p>
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
          padding: '14px 28px',
          borderRadius: 9999,
          border: 'none',
          fontWeight: 800,
          cursor: 'pointer',
          background: 'var(--color-yellow)',
          color: 'var(--color-purple)',
        }}
      >
        Try again
      </button>
    </div>
  )
}
