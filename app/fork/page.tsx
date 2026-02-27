'use client'

import Link from 'next/link'
import ZButton from '@/app/components/ZButton'

export default function ForkPage() {
  return (
    <div className="zz-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <h1 className="zz-page-title" style={{ color: 'var(--color-blue)', marginBottom: 'var(--gap-md)' }}>
        Fork
      </h1>
      <p className="zz-body" style={{ marginBottom: 'var(--gap-lg)', textAlign: 'center' }}>
        Design-spec entry point. Start the main flow from here.
      </p>
      <ZButton href="/intro" variant="secondary">
        Start from intro
      </ZButton>
      <Link href="/zone" className="zz-page-back" style={{ marginTop: 'var(--gap-lg)' }}>
        Go to Zone
      </Link>
    </div>
  )
}
