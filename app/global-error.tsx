'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CircleCTA from './components/CircleCTA'
import { ROUTES } from '@/lib/routes'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Global Error:', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#FCFCFF',
          padding: 20,
          textAlign: 'center',
          color: '#000AFF'
        }}>
          <h2 style={{
            fontFamily: "'helvetica-neue-lt-pro', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: 80,
            lineHeight: 'var(--zz-lh-heading)',
            letterSpacing: '-2px',
            fontWeight: 900,
            textTransform: 'none',
            color: '#000AFF',
            marginBottom: 40
          }}>
            Something went wrong.
          </h2>
          <div style={{ marginTop: 40 }}>
            <CircleCTA onClick={() => router.push(ROUTES.ZONE)} variant="text" text="zone" />
          </div>
        </div>
      </body>
    </html>
  )
}
