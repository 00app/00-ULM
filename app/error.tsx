'use client'

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
      <p style={{ margin: 0, maxWidth: 420, opacity: 0.9 }}>{error?.message || 'Unknown error'}</p>
      <button
        type="button"
        onClick={reset}
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
