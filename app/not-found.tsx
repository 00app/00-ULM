import Link from 'next/link'
import { ROUTES } from '@/lib/routes'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-purple)',
        color: 'var(--color-yellow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
        gap: 24,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-roboto)',
          fontWeight: 900,
          fontSize: 30,
          lineHeight: 'var(--zz-lh-heading)',
        }}
      >
        Page not found
      </h2>
      <p style={{ margin: 0 }}>This URL doesn’t exist. Go back to the app.</p>
      <Link
        href={ROUTES.HOME}
        style={{
          padding: '14px 28px',
          borderRadius: 9999,
          background: 'var(--color-yellow)',
          color: 'var(--color-purple)',
          fontWeight: 800,
          fontSize: 20,
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}
      >
        Back to intro
      </Link>
    </div>
  )
}
