import Link from 'next/link'
import { ROUTES } from '@/lib/routes'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--white)',
        color: 'var(--blue)',
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
          fontFamily: 'var(--font-text)',
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
          background: 'var(--white)',
          color: 'var(--blue)',
          boxShadow: 'var(--elev-1)',
          fontFamily: 'var(--font-cta)',
          fontWeight: 900,
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
