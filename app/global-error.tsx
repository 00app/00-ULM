'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CircleCTA from './components/CircleCTA'

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
          background: '#FDFDFF',
          padding: 20,
          textAlign: 'center'
        }}>
          <h2 style={{
            fontFamily: 'Roboto',
            fontSize: 80,
            lineHeight: '76px',
            letterSpacing: '-2px',
            fontWeight: 900,
            textTransform: 'lowercase',
            color: '#000AFF',
            marginBottom: 40
          }}>
            something went wrong.
          </h2>
          <div style={{ marginTop: 40 }}>
            <CircleCTA onClick={() => router.push('/zone')} variant="text" text="zone" />
          </div>
        </div>
      </body>
    </html>
  )
}
