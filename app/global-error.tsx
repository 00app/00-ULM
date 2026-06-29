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
          background: '#141268',
          padding: 20,
          textAlign: 'center',
          color: '#FDFD00'
        }}>
          <h2 style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: 80,
            lineHeight: 'var(--zz-lh-heading)',
            letterSpacing: '-2px',
            fontWeight: 900,
            textTransform: 'lowercase',
            color: '#FDFD00',
            marginBottom: 40
          }}>
            something went wrong.
          </h2>
          <div style={{ marginTop: 40 }}>
            <CircleCTA onClick={() => router.push(ROUTES.ZONE)} variant="text" text="zone" />
          </div>
        </div>
      </body>
    </html>
  )
}
